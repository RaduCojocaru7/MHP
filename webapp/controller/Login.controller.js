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

          // setează modelul "loggedUser" pe care îl folosesc dashboard-urile tale
          var oLogged = new JSONModel({
            fullName:     u.NAME,
            email:        u.EMAIL,
            careerLevel:  u.CAREER_LVL,
            serviceUnit:  u.SU,
            businessArea: u.BUSINESS_AREA || "", // dacă nu există în entitate, îl lăsăm gol
            personalNr:   u.PERSONAL_NR,
            fiscalYear:   u.FISCAL_YR,
            role:         u.ROLE
          });
          this.getOwnerComponent().setModel(oLogged, "loggedUser");

          try { window.localStorage.setItem("savedEmail", u.EMAIL); } catch (e) {}
          this.clearInputs();
          MessageToast.show("Welcome, " + (u.NAME || "user") + "!");

          // rutare după rol
          var sRole = (u.ROLE || "").toLowerCase();
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
