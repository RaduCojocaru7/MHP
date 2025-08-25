sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/ui/core/BusyIndicator"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, BusyIndicator) {
  "use strict";

  return Controller.extend("fbtool.controller.Login", {
    onInit: function () {
      this.clearInputs();

      this.getView().addEventDelegate({
        onAfterRendering: function() {
          this._addEnterKeyListeners();
        }.bind(this)
         });
    },

    _addEnterKeyListeners: function() {
      // Add Enter key support to both email and password fields
      var oEmailInput = this.byId("emailInput");
      var oPasswordInput = this.byId("passwordInput");
      
      if (oEmailInput) {
        oEmailInput.attachBrowserEvent("keypress", function(oEvent) {
          if (oEvent.which === 13) { // Enter key
            this.onLogin();
          }
        }.bind(this));
      }
      
      if (oPasswordInput) {
        oPasswordInput.attachBrowserEvent("keypress", function(oEvent) {
          if (oEvent.which === 13) { // Enter key
            this.onLogin();
          }
        }.bind(this));
      }
    },

    getLogoSrc: function () {
      // Rezolvare corectă în FLP și local
      var s = sap.ui.require.toUrl("fbtool/img/mhp-logo.png");
      // (opțional) debug:
      // console.log("Logo path:", s);
      return s;
    },
    
    // păstrează emailul salvat, golește parola
    clearInputs: function () {
      try {
        var lastEmail = window.localStorage.getItem("savedEmail") || "";
        this.byId("emailInput")?.setValue(lastEmail);
        this.byId("passwordInput")?.setValue("");
      } catch (e) {}
    },

    onForgotPassword: function () {
      this.getOwnerComponent().getRouter().navTo("ForgotPassword");
    },

    onTogglePasswordVisibility: function () {
      var oPasswordInput = this.byId("passwordInput");
      if (!oPasswordInput) return;
      oPasswordInput.setType(oPasswordInput.getType() === "Password" ? "Text" : "Password");
    },

    onLogin: function () {
      var sEmail = (this.byId("emailInput").getValue() || "").trim();
      var sPass  = (this.byId("passwordInput").getValue() || "").trim();

      if (!sEmail || !sPass) {
        MessageToast.show("Please enter both email and password.");
        return;
      }

      // în tabel/email OData e cu uppercase → normalizează emailul la uppercase
      var sEmailUpper = sEmail.toUpperCase();

      // ia modelul OData: default sau denumit "mainService"
      var oModel = this.getOwnerComponent().getModel() ||
                   this.getOwnerComponent().getModel("mainService");

      if (!oModel) {
        MessageToast.show("OData model not available.");
        // debug ajutător:
        console.error("No OData model (default or 'mainService'). Check manifest & ui5-local.yaml proxy.");
        return;
      }

      // filtre EXACT pe numele proprietăților din $metadata (UPPERCASE)
      var aFilters = [
        new Filter("EMAIL",    FilterOperator.EQ, sEmailUpper),
        new Filter("PASSWORD", FilterOperator.EQ, sPass)
      ];

      BusyIndicator.show(0);
      oModel.read("/UserSet", {
        filters: aFilters,
        urlParameters: { "$top": 1 }, // e suficient primul match
        success: function (oData) {
          BusyIndicator.hide();
          var aRes = oData && oData.results ? oData.results : [];
          if (!aRes.length) {
            MessageToast.show("Invalid email or password.");
            return;
          }

          var u = aRes[0]; // utilizatorul găsit

          console.log("Raw backend data:", JSON.stringify(u, null, 2));
          console.log("Individual field analysis:");
          console.log("  - CAREER_LV (correct name):", typeof u.CAREER_LV, "->", u.CAREER_LV);
          console.log("  - SU:", typeof u.SU, "->", u.SU);
          console.log("  - PERSONAL_NR:", typeof u.PERSONAL_NR, "->", u.PERSONAL_NR);

          // CLEAR any existing loggedUser model first
          var oExistingModel = this.getOwnerComponent().getModel("loggedUser");
          if (oExistingModel) {
            oExistingModel.destroy();
          }

          // setează modelul "loggedUser" pe care îl folosesc dashboard-urile tale
          var oLogged = new JSONModel({
            fullName:     u.NAME,
            email:        u.EMAIL,
            careerLevel:  u.CAREER_LV,
            serviceUnit:  u.SU,
            personalNr:   u.PERSONAL_NR,
            fiscalYear:   u.FISCAL_YR,
            role:         u.ROLE,
            userId:       u.USER_ID,                
            teamManager:  u.TEAM_MNGR 
          });
          
          // Force model to be fresh
          oLogged.setSizeLimit(1000);
          this.getOwnerComponent().setModel(oLogged, "loggedUser");
          
          console.log("New loggedUser model created:", oLogged.getData());

          try { window.localStorage.setItem("savedEmail", u.EMAIL); } catch (e) {}
          this.clearInputs();
          MessageToast.show("Welcome, " + (u.NAME || "user") + "!");

          // rutare după rol
          var sRole = (u.ROLE || "").toLowerCase().trim();
          if (sRole === "manager") {
            this.getOwnerComponent().getRouter().navTo("ManagerDashboard");
          } else if (sRole === "hr") {
            this.getOwnerComponent().getRouter().navTo("HRDashboard");
          } else {
            this.getOwnerComponent().getRouter().navTo("UserDashboard");
          }
        }.bind(this),
        error: function (oErr) {
          BusyIndicator.hide();
          console.error("OData login read error:", oErr);
          MessageToast.show("Backend error. Please try again.");
        }
      });
    }
  });
});