sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter", "sap/ui/model/FilterOperator",
  "sap/m/MessageToast", "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("fbtool.controller.ManagerPegEdit", {


  

    _getInitialPegData: function () {
    
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
      const m = this.getView().getModel("peg");
      m.setData(this._getInitialPegData());
      m.refresh(true);

      const oModel = this.getOwnerComponent().getModel();
      if (oModel && oModel.resetChanges) { oModel.resetChanges(); }

      const inp = this.byId("pegReqInput");
      if (inp) { setTimeout(() => inp.focus(), 0); }
    },

    _readFirst: function (path, aFilters, sSelect) {
      const oModel = this.getOwnerComponent().getModel();
      return new Promise((resolve, reject) => {
        oModel.read(path, {
          filters: aFilters || [],
          urlParameters: sSelect ? { $select: sSelect } : undefined,
          success: (d) => resolve(d && d.results && d.results[0]),
          error: reject
        });
      });
    },

  

    onInit: function () {
      this.getView().setModel(new JSONModel(this._getInitialPegData()), "peg");
    },

  

    onReqChange: function () {
      const oModel = this.getOwnerComponent().getModel();
      const oPeg   = this.getView().getModel("peg");
      const sReq   = oPeg.getProperty("/PEG_REQ_NR");
      if (!sReq) { return; }

      this.getView().setBusy(true);

      oModel.read("/Peg_RequestSet", {
        filters: [ new Filter("PEG_REQ_NR", FilterOperator.EQ, sReq) ],
        success: (oData) => {
          if (!oData.results || !oData.results.length) {
            this.getView().setBusy(false);
            MessageBox.warning("PEG request not found.");
            return;
          }
          oPeg.setProperty("/PEG_ID", oData.results[0].PEG_ID);
          this.getView().setBusy(false);
        },
        error: () => {
          this.getView().setBusy(false);
          MessageBox.error("Error while reading the PEG request.");
        }
      });
    },

  
    onSave: function () {
      const oView  = this.getView();
      const oModel = this.getOwnerComponent().getModel();
      const p      = oView.getModel("peg").getData();

      if (!p.PEG_REQ_NR)  { MessageToast.show("Please enter the PEG request number."); return; }
      if (!p.PEG_ID)      { MessageToast.show("PEG_ID not found for this request.");   return; }

      const allPicked = [p.EXPERTISE, p.NETWORK, p.TEAMING, p.PASSION, p.AUTONOMY]
        .every(v => (v|0) >= 0);
      if (!allPicked) {
        MessageToast.show("Please select a grade for all criteria before saving.");
        return;
      }

      const mk = (crit, idx, txt) => ({
        PEG_ID:        p.PEG_ID,
        CRIT_ID:       crit,
        GRADE:         (idx|0) + 1,     
        GRADE_COMMENT: txt || "",
        STATUS:        "SENT",
        REVIEW_DATE:   new Date()
      });

      const payloads = [
        mk("01", p.EXPERTISE, p.EXPERTISE_TXT),
        mk("02", p.NETWORK,   p.NETWORK_TXT),
        mk("03", p.TEAMING,   p.TEAMING_TXT),
        mk("04", p.PASSION,   p.PASSION_TXT),
        mk("05", p.AUTONOMY,  p.AUTONOMY_TXT)
      ];

      oView.setBusy(true);
      const createOne = (i) => {
        if (i >= payloads.length) {
          return this._markReqDone(p.PEG_REQ_NR, p.PEG_ID);
        }
        oModel.create("/Peg_GradesSet", payloads[i], {
          success: () => createOne(i + 1),
          error:   () => { oView.setBusy(false); MessageBox.error("Error while saving grades."); }
        });
      };
      createOne(0);
    },

    _markReqDone: function (sReqNr, sPegId) {
      const oView  = this.getView();
      const oModel = this.getOwnerComponent().getModel();
      const sKey   = oModel.createKey("/Peg_RequestSet", { PEG_REQ_NR: sReqNr, PEG_ID: sPegId });

      oModel.update(sKey, { STATUS: "DONE" }, {
        success: () => { oView.setBusy(false); MessageToast.show("Grades saved successfully. PEG request completed."); this._resetForm(); },
        error:   () => { oView.setBusy(false); MessageToast.show("Grades saved, but the request status could not be updated."); }
      });
    },

    /*  export: header (employee/project) + grades */

    _formatYear: function (v) {
  const d = (v instanceof Date) ? v : new Date(v);
  return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { year: "numeric" });
},



    onExport: async function () {
      const oModel = this.getOwnerComponent().getModel();
      const peg = this.getView().getModel("peg").getData();
      


      if (!peg.PEG_REQ_NR) {
        MessageToast.show("Please enter the PEG request number first.");
        return;
      }

      try {
        this.getView().setBusy(true);

        // 1) PEG request
        const req = await this._readFirst(
          "/Peg_RequestSet",
          [ new Filter("PEG_REQ_NR", FilterOperator.EQ, peg.PEG_REQ_NR) ],
          "PEG_ID,PEG_REQ_NR,USER_ID,MANAGER_ID,PROJ_NUMBER,REQUEST_DATE"
        );
        if (!req) {
          this.getView().setBusy(false);
          MessageBox.warning("PEG request was not found.");
          return;
        }

        const yearVal = this._formatYear(req.REQUEST_DATE);

        // 2) Employee and 3) Manager 
        const emp = await this._readFirst(
  "/UserSet",
  [ new Filter("USER_ID", FilterOperator.EQ, req.USER_ID) ]
);

        const mgr = await this._readFirst(
          "/UserSet",
          [ new Filter("USER_ID", FilterOperator.EQ, req.MANAGER_ID) ],
          "USER_ID,NAME"
        );

        const todayStr = new Date().toLocaleDateString("ro-RO");
        const headerRows = [
          { Field: "Year",            Value: yearVal  || "" },
          { Field: "Employee Name",   Value: emp?.NAME || "" },
          { Field: "Personal Number", Value: emp?.PERSONAL_NR || "" },
          { Field: "Current Level",   Value: emp?.CAREER_LV || "" },
          { Field: "SU",              Value: emp?.SU || "" },
          { Field: "PEG number",      Value: req.PEG_REQ_NR || "" },
          { Field: "Project",         Value: req.PROJ_NUMBER || "" },
          { Field: "Evaluator",       Value: mgr?.NAME || "" },
          { Field: "Date",            Value: todayStr }
        ];

        const toGrade = (i) => (i | 0) >= 0 ? (i | 0) + 1 : "";
        const gradeRows = [
          { Criterion: "Expertise and Working Results",          Grade: toGrade(peg.EXPERTISE), Comment: peg.EXPERTISE_TXT || "" },
          { Criterion: "Networking Skills and Entrepreneurship", Grade: toGrade(peg.NETWORK),   Comment: peg.NETWORK_TXT   || "" },
          { Criterion: "Teaming and Partnership",                Grade: toGrade(peg.TEAMING),   Comment: peg.TEAMING_TXT   || "" },
          { Criterion: "Passion and Resilience",                 Grade: toGrade(peg.PASSION),   Comment: peg.PASSION_TXT   || "" },
          { Criterion: "Autonomy and Leadership",                Grade: toGrade(peg.AUTONOMY),  Comment: peg.AUTONOMY_TXT  || "" }
        ];

        const dataForSheet = [ ...headerRows, {}, ...gradeRows ];

        sap.ui.require([
          "sap/ui/export/Spreadsheet",
          "sap/ui/export/library"
        ], (Spreadsheet, exportLibrary) => {
          try {
            const EdmType = exportLibrary && exportLibrary.EdmType;
            if (!Spreadsheet || !EdmType) { throw new Error("sap.ui.export not available."); }

            const columns = [
              { label: "Field",        property: "Field",     type: EdmType.String, width: 24 },
              { label: "Value",        property: "Value",     type: EdmType.String, width: 40 },
              { label: "Criterion",    property: "Criterion", type: EdmType.String, width: 36 },
              { label: "Grade (1–5)",  property: "Grade",     type: EdmType.Number, width: 14 },
              { label: "Comment",      property: "Comment",   type: EdmType.String, width: 60, wrap: true }
            ];

            const ts = new Date().toISOString().replace(/[:.-]/g, "").slice(0, 15);
            const fileName = `PEG_Report_${req.PEG_REQ_NR || "export"}_${ts}.xlsx`;

            new Spreadsheet({
              workbook: { columns },
              dataSource: dataForSheet,
              fileName
            }).build()
              .then(() => MessageToast.show("Excel report generated."))
              .finally(() => this.getView().setBusy(false));

          } catch (err) {
            this._exportCsvFallback(headerRows, gradeRows, req.PEG_REQ_NR);
            this.getView().setBusy(false);
          }
        }, () => {
          this._exportCsvFallback(headerRows, gradeRows, req.PEG_REQ_NR);
          this.getView().setBusy(false);
        });

      } catch (e) {
        this.getView().setBusy(false);
        MessageBox.error("Failed to build the Excel report.");
        
      }
    },

    _exportCsvFallback: function (headerRows, gradeRows, pegReqNr) {
      const esc = (v) => {
        const s = (v == null ? "" : String(v));
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

      const lines = [];
      lines.push(["Field", "Value"].map(esc).join(","));
      headerRows.forEach(r => lines.push([r.Field, r.Value].map(esc).join(",")));
      lines.push("");
      lines.push(["Criterion", "Grade (1–5)", "Comment"].map(esc).join(","));
      gradeRows.forEach(r => lines.push([r.Criterion, r.Grade, r.Comment].map(esc).join(",")));

      const csv = lines.join("\n");
      const ts = new Date().toISOString().replace(/[:.-]/g, "").slice(0, 15);
      const fileName = `PEG_Report_${pegReqNr || "export"}_${ts}.csv`;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      MessageToast.show("CSV report generated.");
    }

  });
});
