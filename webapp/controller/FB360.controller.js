sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, MessageBox, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("fbtool.controller.FB360", {

    onInit: function () {
      // USER: type-ahead + schimbarea userului -> filtrează proiectele
      var oUserCB = this.byId("userCombo");
      if (oUserCB && oUserCB.setFilterFunction) {
        oUserCB.setFilterFunction(function (sTerm, oItem) {
          var s = (oItem.getText() || "").toLowerCase();
          return s.indexOf((sTerm || "").toLowerCase()) !== -1;
        });
      }
      if (oUserCB) { oUserCB.attachChange(this._onUserChange, this); }

      // PROJECT: type-ahead + selectionChange + change (robust)
      var oProjCB = this.byId("projectCombo");
      if (oProjCB && oProjCB.setFilterFunction) {
        oProjCB.setFilterFunction(function (sTerm, oItem) {
          var s = (oItem.getText() || "").toLowerCase();
          return s.indexOf((sTerm || "").toLowerCase()) !== -1;
        });
      }
      if (oProjCB) {
        oProjCB.attachSelectionChange(this._onProjectSelectionChange, this);
        oProjCB.attachChange(this._onProjectChange, this);

        // la init: fără user -> ascunde lista
        var oBinding = oProjCB.getBinding("items");
        if (oBinding) { oBinding.filter([]); }
        oProjCB.setSelectedKey("");
        oProjCB.setValue("");
      }
    },

    /* === USER === */
    _onUserChange: function () {
      var sUserId = this.byId("userCombo").getSelectedKey();
      var oProjCB = this.byId("projectCombo");
      if (!oProjCB) { return; }

      // reset proiect când se schimbă userul
      oProjCB.setSelectedKey("");
      oProjCB.setValue("");

      this._filterProjectsForUser(sUserId);
    },

    _filterProjectsForUser: function (sUserId) {
      var oProjCB = this.byId("projectCombo");
      var oBinding = oProjCB && oProjCB.getBinding("items");
      if (!oBinding) { return; }
      oBinding.filter(sUserId ? [ new Filter("USER_ID", FilterOperator.EQ, sUserId) ] : []);
    },

    /* === PROJECT === */
    // select din listă -> păstrăm stabil atât key cât și text
    _onProjectSelectionChange: function (oEvent) {
      var oProjCB = oEvent.getSource();
      var oItem   = oEvent.getParameter("selectedItem");
      if (oItem) {
        oProjCB.setSelectedKey(oItem.getKey());
        oProjCB.setValue(oItem.getText());
      }
    },

    // blur / X / text liber
    _onProjectChange: function (oEvent) {
      var oProjCB = oEvent.getSource();
      var sVal    = oEvent.getParameter("value") || "";
      var sKey    = oProjCB.getSelectedKey();
      var oSel    = oProjCB.getSelectedItem();

      // 1) X apăsat sau valoare ștearsă -> clean total
      if (!sVal) {
        oProjCB.setSelectedKey("");
        oProjCB.setValue("");
        return;
      }

      // 2) Dacă există deja selectedKey, NU mai curățăm. Sincronizăm doar textul.
      if (sKey) {
        if (oSel) { oProjCB.setValue(oSel.getText()); }
        return;
      }

      // 3) Nu există key, userul a tastat text: încercăm să mapăm text -> item
      var aItems = oProjCB.getItems() || [];
      var oMatch = aItems.find(function (it) {
        return (it.getText() || "").toLowerCase() === sVal.toLowerCase();
      });

      if (oMatch) {
        oProjCB.setSelectedKey(oMatch.getKey());
        oProjCB.setValue(oMatch.getText());
      } else {
        // text liber care nu corespunde: nu lăsăm selecție fantomă
        oProjCB.setSelectedKey("");
        oProjCB.setValue("");
        MessageToast.show("Selectează un proiect din listă.");
      }
    },

    /* === SEND === */
    onSendFeedback: function () {
      var oModel  = this.getOwnerComponent().getModel("mainService"); // OData V2

      var sToUser = this.byId("userCombo").getSelectedKey();  // TO_USER_ID

      var oProjCB = this.byId("projectCombo");
      var sProjId = oProjCB.getSelectedKey()
                || (oProjCB.getSelectedItem() && oProjCB.getSelectedItem().getKey())
                || "";  // PROJ_ID

      var sTypeId = this.byId("typeCombo").getSelectedKey();  // FB_TYPE_ID
      var sText   = this.byId("feedbackText").getValue();

      // rezolvăm FROM_USER_ID (userul logat)
      this._resolveFromUserId().then(function (sFromUser) {
        var missing = [];
        if (!sFromUser) missing.push("From User");
        if (!sToUser)   missing.push("User");
        if (!sProjId)   missing.push("Project");
        if (!sTypeId)   missing.push("Feedback Type");
        if (!sText)     missing.push("Feedback");
        if (missing.length) {
          MessageToast.show("Completează: " + missing.join(", ") + ".");
          return;
        }

        var oPayload = {
          FROM_USER_ID : sFromUser,
          TO_USER_ID   : sToUser,
          PROJ_ID      : sProjId,
          FB_TYPE_ID   : sTypeId,
          INPUT_TEXT   : sText,
          IS_ANONYMOUS : ""   // sau "X" dacă vei adăuga checkbox
        };

        // POST simplu (fără $batch)
        if (oModel.setUseBatch) { oModel.setUseBatch(false); }

        this.getView().setBusy(true);
        oModel.metadataLoaded().then(function () {
          oModel.create("/FeedbackSet", oPayload, {
            success: function (oCreated) {
              this.getView().setBusy(false);
              MessageToast.show("Feedback trimis. ID: " + (oCreated.FB_ID || "-"));

              // 🔹 curățăm formularul complet după succes
              this._resetForm();
            }.bind(this),
            error: function (oErr) {
              this.getView().setBusy(false);
              var msg = "Eroare la trimitere (FeedbackSet create).";
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

    /* === HELPERS === */
    _resetForm: function () {
      // user
      var oUserCB = this.byId("userCombo");
      if (oUserCB) {
        oUserCB.setSelectedKey("");
        oUserCB.setValue("");
      }

      // project + ștergem filtrul
      var oProjCB = this.byId("projectCombo");
      if (oProjCB) {
        oProjCB.setSelectedKey("");
        oProjCB.setValue("");
        var oBinding = oProjCB.getBinding("items");
        if (oBinding) { oBinding.filter([]); }
      }

      // feedback type
      var oTypeCB = this.byId("typeCombo");
      if (oTypeCB) { oTypeCB.setSelectedKey(""); }

      // text
      var oText = this.byId("feedbackText");
      if (oText) { oText.setValue(""); }
    },

    _resolveFromUserId: function () {
      var oComp   = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");

      // 1) model
      if (oLogged) {
        var id = oLogged.getProperty("/user_id") || oLogged.getProperty("/USER_ID") || "";
        if (id) {
          try { localStorage.setItem("loggedUserId", id); } catch (e) {}
          return Promise.resolve(id);
        }
      }

      // 2) cache
      try {
        var cached = localStorage.getItem("loggedUserId") || "";
        if (cached) { return Promise.resolve(cached); }
      } catch (e) {}

      // 3) OData după EMAIL
      var email = "";
      if (oLogged) {
        email = oLogged.getProperty("/email") || oLogged.getProperty("/EMAIL") || "";
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
              if (oLogged) { oLogged.setProperty("/user_id", uid); }
              try { localStorage.setItem("loggedUserId", uid); } catch (e) {}
            }
            resolve(uid);
          },
          error: function () { resolve(""); }
        });
      });
    },

   onBack: function () {
  var oComponent = this.getOwnerComponent();
  var oLoggedUserModel = oComponent.getModel("loggedUser");
  var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

  if (oLoggedUserModel) {
    var userData = oLoggedUserModel.getData();
    var role = (userData.role || "").toLowerCase();
    
    if (role === "manager") {
      oRouter.navTo("ManagerDashboard");
    } else {
      oRouter.navTo("UserDashboard");
    }
  } else {
    // Fallback la UserDashboard dacă nu găsim datele utilizatorului
    oRouter.navTo("UserDashboard");
  }
}
  });
});
