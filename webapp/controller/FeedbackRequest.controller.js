sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter"
], function (Controller, UIComponent, MessageToast, MessageBox, JSONModel, Filter, FilterOperator, Sorter) {
  "use strict";

  return Controller.extend("fbtool.controller.FeedbackRequest", {

    onInit: function () {
      // model local pt. PM + alte ajutoare
      var oLocal = new JSONModel({
        pmId:   "",
        pmName: ""
      });
      this.getView().setModel(oLocal, "fr");

      var oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("FeedbackRequest").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this._bindTeamMembers();

      // reset selections
      var oV = this.getView();
      oV.byId("teamMemberCombo").setSelectedKey("");
      var oProj = oV.byId("projectSelect");
      oProj.setSelectedKey(""); oProj.setValue("");
      this.getView().getModel("fr").setData({ pmId: "", pmName: "" });
    },

    /* ================= TEAM MEMBERS (ca MyTeam) ================= */
    _bindTeamMembers: function () {
      var oLogged = this.getOwnerComponent().getModel("loggedUser");
      var sMgrName = (oLogged && (oLogged.getProperty("/fullName") || oLogged.getProperty("/NAME"))) || "";
      sMgrName = sMgrName.trim();
      if (!sMgrName) { return; }

      var oCB = this.byId("teamMemberCombo");
      var oBinding = oCB && oCB.getBinding("items");
      if (!oBinding) { return; }

      var oTeamFilter = new Filter({
        and: false,
        filters: [
          new Filter("TEAM_MNGR", FilterOperator.EQ, sMgrName),
          new Filter("TEAM_MNGR", FilterOperator.EQ, sMgrName.toUpperCase())
        ]
      });

      oBinding.filter([oTeamFilter], "Application");
      oBinding.sort([ new Sorter("NAME", false) ]);
    },

    /* === când aleg userul: filtrez proiectele după USER_ID și curăț PM === */
    onTeamMemberChange: function () {
      var sUserId = this.byId("teamMemberCombo").getSelectedKey();

      var oProjCB = this.byId("projectSelect");
      oProjCB.setSelectedKey(""); 
      oProjCB.setValue("");

      this.getView().getModel("fr").setData({ pmId: "", pmName: "" });

      var oBinding = oProjCB && oProjCB.getBinding("items");
      if (oBinding) {
        oBinding.filter(sUserId ? [ new Filter("USER_ID", FilterOperator.EQ, sUserId) ] : []);
      }
    },

    /* === când aleg proiectul: determin automat Project Manager-ul === */
    onProjectSelectionChange: function (oEvent) {
      var sProjId = this.byId("projectSelect").getSelectedKey()
                 || (oEvent && oEvent.getParameter("selectedItem") && oEvent.getParameter("selectedItem").getKey())
                 || "";
      if (!sProjId) {
        this.getView().getModel("fr").setData({ pmId: "", pmName: "" });
        return;
      }
      this._autoAssignPM(sProjId);
    },

    _autoAssignPM: function (sProjectId) {
      var oModel = this.getOwnerComponent().getModel("mainService");
      var oLocal = this.getView().getModel("fr");

      oModel.read("/Manager_ProjectsSet", {
        filters: [ new Filter("PROJ_ID", FilterOperator.EQ, sProjectId) ],
        success: function (oData) {
          var a = (oData && oData.results) || [];
          if (!a.length) {
            oLocal.setData({ pmId: "", pmName: "" });
            MessageToast.show("No project manager defined for this project.");
            return;
          }
          var sPmId = a[0].MNGR_ID;
          oLocal.setProperty("/pmId", sPmId);

          // lookup nume PM din UserSet
          oModel.read("/UserSet", {
            filters: [ new Filter("USER_ID", FilterOperator.EQ, sPmId) ],
            urlParameters: { "$select": "USER_ID,NAME" },
            success: function (oU) {
              var name = (oU.results && oU.results[0] && oU.results[0].NAME) || "";
              oLocal.setProperty("/pmName", name);
            }
          });
        }.bind(this),
        error: function () {
          oLocal.setData({ pmId: "", pmName: "" });
          MessageToast.show("Could not load project manager.");
        }
      });
    },

    /* ================= SEND ================= */
    onSubmitFeedback: function () {
      var oView   = this.getView();
      var oModel  = this.getOwnerComponent().getModel("mainService");

      // câmpuri din UI
      var sTeamMemberId = oView.byId("teamMemberCombo").getSelectedKey(); // TEAM_MBR_ID
      var sProjId       = oView.byId("projectSelect").getSelectedKey();   // PROJ_ID
      var sText         = oView.byId("feedbackMessage").getValue();       // INPUT_TEXT
      var oFR           = oView.getModel("fr").getData() || {};           // pmId/pmName

      // validare simplă
      var missing = [];
      if (!sTeamMemberId) missing.push("Team member");
      if (!sProjId)       missing.push("Project");
      if (!oFR.pmId)      missing.push("Project Manager");
      if (!sText || !sText.trim()) missing.push("Message");
      if (missing.length) {
        MessageToast.show("Completează: " + missing.join(", ") + ".");
        return;
      }

      // FROM_MNGR_ID = managerul logat (USER_ID)
      this._resolveLoggedUserId().then(function (sFromMgrId) {
        if (!sFromMgrId) {
          MessageToast.show("Nu pot identifica managerul logat.");
          return;
        }

        var oPayload = {
          // lasă FB_REQ_ID / FB_REQ_NR necompletate: ABAP le generează
          FROM_MNGR_ID : sFromMgrId,
          TO_MNGR_ID   : oFR.pmId,        // PM-ul proiectului ales
          TEAM_MBR_ID  : sTeamMemberId,   // membrul selectat
          SEND_DATE    : new Date(),      // backend mapează pe DATS/DateTime
          INPUT_TEXT   : sText,
          PROJ_ID      : sProjId,
          STATUS       : "PENDING"        // sau ce status vrei la creare
        };

        // POST simplu (ca în 360FB/PEG)
        if (oModel.setUseBatch) { oModel.setUseBatch(false); }

        oView.setBusy(true);
        oModel.metadataLoaded().then(function () {
          oModel.create("/Manager_Feedback_RequestSet", oPayload, {
            success: function (oCreated) {
              oView.setBusy(false);
              
              // Crează mesaj de succes cu numele PM-ului și team member-ului
              var sPmName = oFR.pmName || "Project Manager";
              var sTeamMemberName = "";
              var oTeamCombo = oView.byId("teamMemberCombo");
              var oSelectedTeamItem = oTeamCombo && oTeamCombo.getSelectedItem();
              if (oSelectedTeamItem) {
                sTeamMemberName = oSelectedTeamItem.getText();
              }
              
              var sRequestNr = (oCreated && oCreated.FB_REQ_NR) || "";
              var successMsg = "";
              
              if (sRequestNr) {
                successMsg = "Feedback request #" + sRequestNr + " sent successfully";
                if (sTeamMemberName && sPmName) {
                  successMsg += " for " + sTeamMemberName + " to " + sPmName;
                }
                successMsg += "!";
              } else {
                successMsg = "Feedback request sent successfully";
                if (sTeamMemberName && sPmName) {
                  successMsg += " for " + sTeamMemberName + " to " + sPmName;
                }
                successMsg += "!";
              }

              MessageToast.show(successMsg);

              // curățare formular
              this._resetForm();
              UIComponent.getRouterFor(this).navTo("ManagerDashboard");
            }.bind(this),
            error: function (oErr) {
              oView.setBusy(false);
              var msg = "Eroare la trimitere (Manager_Feedback create).";
              try {
                var r = JSON.parse(oErr.responseText);
                msg = (r && r.error && r.error.message && r.error.message.value) || msg;
              } catch (e) {}
              MessageBox.error(msg);
            }.bind(this)
          });
        }.bind(this));
      }.bind(this));
    },

    _resetForm: function () {
      var oV = this.getView();
      var oCB1 = oV.byId("teamMemberCombo");
      var oCB2 = oV.byId("projectSelect");

      if (oCB1) oCB1.setSelectedKey("");
      if (oCB2) { oCB2.setSelectedKey(""); oCB2.setValue(""); var b = oCB2.getBinding("items"); if (b) b.filter([]); }
      var oTxt = oV.byId("feedbackMessage"); if (oTxt) oTxt.setValue("");
      this.getView().getModel("fr").setData({ pmId: "", pmName: "" });
    },

    _resolveLoggedUserId: function () {
      // Aceeași logică folosită în FB360: caută USER_ID din modelul loggedUser,
      // altfel rezolvă după EMAIL via /UserSet.
      var oComp   = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");

      if (oLogged) {
        var id = oLogged.getProperty("/userId") || "";
        if (id) {
          try { localStorage.setItem("loggedUserId", id); } catch (e) {}
          return Promise.resolve(id);
        }
      }

      try {
        var cached = localStorage.getItem("loggedUserId") || "";
        if (cached) { return Promise.resolve(cached); }
      } catch (e) {}

      var email = "";
      if (oLogged) {
        email = oLogged.getProperty("/email") || "";
      }
      try { if (!email) email = localStorage.getItem("loggedEmail") || ""; } catch (e) {}
      if (!email) { return Promise.resolve(""); }

      var sEmailUp = email.toUpperCase();
      var oModel  = oComp.getModel("mainService");

      return new Promise(function (resolve) {
        oModel.read("/UserSet", {
          filters: [ new Filter("EMAIL", FilterOperator.EQ, sEmailUp) ],
          urlParameters: { "$select": "USER_ID,EMAIL" },
          success: function (oData) {
            var uid = (oData.results && oData.results[0] && oData.results[0].USER_ID) || "";
            if (uid) {
              if (oLogged) { oLogged.setProperty("/userId", uid); }
              try { localStorage.setItem("loggedUserId", uid); } catch (e) {}
            }
            resolve(uid);
          },
          error: function () { resolve(""); }
        });
      });
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("ManagerDashboard");
    }
  });
});