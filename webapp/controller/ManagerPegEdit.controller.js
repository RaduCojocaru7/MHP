sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter", "sap/ui/model/FilterOperator",
  "sap/m/MessageToast", "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("fbtool.controller.ManagerPegEdit", {

 
    _getInitialPegData: function () {
      // pun -1 pe selectedIndex ca să fie clar ca nu e ales nimic după reset
      return {
        PEG_REQ_NR: "",
        PEG_ID: "",

        EXPERTISE: -1,  EXPERTISE_TXT: "",
        NETWORK:   -1,  NETWORK_TXT: "",
        TEAMING:   -1,  TEAMING_TXT: "",
        PASSION:   -1,  PASSION_TXT: "",
        AUTONOMY:  -1,  AUTONOMY_TXT: ""
      };
    },

    _resetForm: function () {
      // curat tot modelul peg după ce salvez cu succes
      const m = this.getView().getModel("peg");
      m.setData(this._getInitialPegData());
      m.refresh(true);

      // curat eventualele schimbări OData rămase 
      const oModel = this.getOwnerComponent().getModel();
      if (oModel && oModel.resetChanges) { oModel.resetChanges(); }

     
      const inp = this.byId("pegReqInput"); 
      if (inp) { setTimeout(() => inp.focus(), 0); }
    },

    onInit: function () {
      // pornesc view-ul cu starea inițială
      this.getView().setModel(new JSONModel(this._getInitialPegData()), "peg");
    },

    /* Dupa ce scriu PEG_REQ_NR, imi iau PEG_ID din Peg_RequestSet */
    onReqChange: function () {
      const oModel = this.getOwnerComponent().getModel();
      const oPeg   = this.getView().getModel("peg");
      const sReq   = oPeg.getProperty("/PEG_REQ_NR");

      console.log("[PEG] onReqChange -> PEG_REQ_NR =", sReq);
      if (!sReq) { return; }

      this.getView().setBusy(true);

      // citesc Peg_RequestSet filtrat după PEG_REQ_NR; din rezultat scot PEG_ID
      oModel.read("/Peg_RequestSet", {
        filters: [ new Filter("PEG_REQ_NR", FilterOperator.EQ, sReq) ],
        success: (oData) => {
          console.log("[PEG] Peg_RequestSet results:", oData.results);
          if (!oData.results || !oData.results.length) {
            this.getView().setBusy(false);
            MessageBox.warning("PEG request not found.");
            return;
          }
          // retin PEG_ID ca sa-l pun pe toate notele
          oPeg.setProperty("/PEG_ID", oData.results[0].PEG_ID);
          console.log("[PEG] Found PEG_ID =", oData.results[0].PEG_ID);
          this.getView().setBusy(false);
        },
        error: (e) => {
          this.getView().setBusy(false);
          console.error("[PEG] read error:", e);
          MessageBox.error("Error while reading the PEG request.");
        }
      });
    },

    /* Save = creez 5 înregistrări in Peg_GradesSet (una câte una) */
    onSave: function () {
      const oView  = this.getView();
      const oModel = this.getOwnerComponent().getModel();
      const p      = oView.getModel("peg").getData();

     
      if (!p.PEG_REQ_NR)  { MessageToast.show("Please enter the PEG request number."); return; }
      if (!p.PEG_ID)      { MessageToast.show("PEG_ID not found for this request.");   return; }

      
      oModel.setUseBatch(false);

      // dacă nu am selectat toate notele, nu pot salva
      const allPicked = [p.EXPERTISE, p.NETWORK, p.TEAMING, p.PASSION, p.AUTONOMY]
        .every(v => (v|0) >= 0);
      if (!allPicked) {
        MessageToast.show("Please select a grade for all criteria before saving.");
        return;
      }

      // helper: convertesc 0..4 din UI în 1..5 pentru backend
      const mk = (crit, idx, txt) => ({
        PEG_ID:        p.PEG_ID,
        CRIT_ID:       crit,            
        GRADE:         (idx|0) + 1,
        GRADE_COMMENT: txt || "",
        STATUS:        "SENT",          // în grades salvez „SENT”; cererea o marchez separat ca DONE !!!
        REVIEW_DATE:   new Date()
        
      });

      const payloads = [
        mk("01", p.EXPERTISE, p.EXPERTISE_TXT),
        mk("02", p.NETWORK,   p.NETWORK_TXT),
        mk("03", p.TEAMING,   p.TEAMING_TXT),
        mk("04", p.PASSION,   p.PASSION_TXT),
        mk("05", p.AUTONOMY,  p.AUTONOMY_TXT)
      ];
      console.log("[PEG] payloads to create:", payloads);

      oView.setBusy(true);

      // trimit create-urile secvential !!! (altfel aveam coliziuni)
      const createOne = (i) => {
        if (i >= payloads.length) {
          // dacă toate au mers, marchez cererea ca DONE
          return this._markReqDone(p.PEG_REQ_NR, p.PEG_ID);
        }
        const pl = payloads[i];
        console.log(`[PEG] CREATE ${i+1}/${payloads.length}`, pl);
        oModel.create("/Peg_GradesSet", pl, {
          success: (data) => {
            console.log(`[PEG] OK create ${i+1}/${payloads.length}`, data);
            createOne(i + 1);
          },
          error: (e) => {
            console.error(`[PEG] ERROR create ${i+1}/${payloads.length}`, e);
            oView.setBusy(false);
            MessageBox.error("Error while saving grades.");
          }
        });
      };

      createOne(0);
    },

    /* Dupa ce am creat notele, pun cererea pe DONE (update pe Peg_RequestSet) */
    _markReqDone: function (sReqNr, sPegId) {
      const oView  = this.getView();
      const oModel = this.getOwnerComponent().getModel();

      // IMPORTANT: aici pun toate cheile definite în MPC pentru Peg_RequestSet
      const keyObj = { PEG_REQ_NR: sReqNr, PEG_ID: sPegId };
      const sKey   = oModel.createKey("/Peg_RequestSet", keyObj);
      console.log("[PEG] UPDATE Peg_RequestSet key:", keyObj, "->", sKey);

      // marchez cererea ca DONE in PEG Request la STATUS
      oModel.update(sKey, { STATUS: "DONE" }, {
        success: () => {
          oView.setBusy(false);
          MessageToast.show("Grades saved successfully. PEG request completed.");
          // aici dau clear
          this._resetForm();
        },
        error: (e) => {
          oView.setBusy(false);
          console.error("[PEG] update error:", e);
          MessageToast.show("Grades saved, but the request status could not be updated.");
        }
      });
    }
  });
});
