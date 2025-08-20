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

      var sEmailUpper = sEmail.toUpperCase();

      var oModel = this.getOwnerComponent().getModel() ||
                   this.getOwnerComponent().getModel("mainService");

      if (!oModel) {
        MessageToast.show("OData model not available.");
        console.error("No OData model (default or 'mainService').");
        return;
      }

      var aFilters = [
        new Filter("EMAIL",    FilterOperator.EQ, sEmailUpper),
        new Filter("PASSWORD", FilterOperator.EQ, sPass)
      ];

      BusyIndicator.show(0);
      oModel.read("/UserSet", {
        filters: aFilters,
        urlParameters: { "$top": 1 },
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

          // setează modelul "loggedUser"
          var oLogged = new JSONModel({
            user_id:      u.USER_ID,      // ← foarte important pentru FROM_USER_ID
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

// sap.ui.define([
//   "sap/ui/core/mvc/Controller",
//   "sap/ui/model/json/JSONModel",
//   "sap/ui/model/Filter",
//   "sap/ui/model/FilterOperator",
//   "sap/m/MessageToast",
//   "sap/ui/core/BusyIndicator"
// ], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, BusyIndicator) {
//   "use strict";

//   return Controller.extend("fbtool.controller.Login", {
//     onInit: function () {
//       this.clearInputs();
//     },

//     clearInputs: function () {
//       try {
//         var sSaved = localStorage.getItem("savedEmail") || "";
//         this.byId("emailInput").setValue(sSaved);
//         this.byId("passwordInput").setValue("");
//       } catch (e) {}
//     },

//     onForgotPassword: function () {
//       this.getOwnerComponent().getRouter().navTo("ForgotPassword");
//     },

//     onLogin: function () {
//       var oModel = this.getOwnerComponent().getModel("mainService"); // OData V2
//       var sEmail = (this.byId("emailInput").getValue() || "").trim();
//       var sPass  = (this.byId("passwordInput").getValue() || "").trim();

//       if (!sEmail || !sPass) {
//         MessageToast.show("Introduceți email și parolă.");
//         return;
//       }

//       // Gateway așteaptă email UPPER dacă așa e salvat în tabel
//       var sEmailUp = sEmail.toUpperCase();

//       var aFilters = [
//         new Filter("EMAIL",    FilterOperator.EQ, sEmailUp),
//         new Filter("PASSWORD", FilterOperator.EQ, sPass)
//       ];

//       BusyIndicator.show(0);
//       oModel.read("/UserSet", {
//         filters: aFilters,
//         urlParameters: { "$select": "USER_ID,EMAIL,NAME,ROLE,TEAM_MNGR" },
//         success: function (oData) {
//           BusyIndicator.hide();

//           if (!oData.results || !oData.results.length) {
//             MessageToast.show("Email sau parolă greșite.");
//             return;
//           }

//           var u = oData.results[0]; // login-ul tău întoarce 1 rând
//           // ✅ salvăm inclusiv USER_ID
//           var oLogged = new JSONModel({
//             user_id   : u.USER_ID,
//             email     : u.EMAIL,
//             name      : u.NAME,
//             role      : u.ROLE,
//             team_mngr : u.TEAM_MNGR
//           });

//           this.getOwnerComponent().setModel(oLogged, "loggedUser");
//           try { localStorage.setItem("savedEmail", sEmail); } catch (e) {}

//           // navigare după rol
//           var role = (u.ROLE || "").toLowerCase();
//           if (role === "manager") {
//             this.getOwnerComponent().getRouter().navTo("ManagerDashboard");
//           } else if (role === "hr") {
//             this.getOwnerComponent().getRouter().navTo("HRDashboard");
//           } else {
//             this.getOwnerComponent().getRouter().navTo("UserDashboard");
//           }
//         }.bind(this),
//         error: function (oErr) {
//           BusyIndicator.hide();
//           // Mesaj backend, dacă există:
//           var msg = "Backend error. Please try again.";
//           try {
//             var r = JSON.parse(oErr.responseText);
//             msg = (r && r.error && r.error.message && r.error.message.value) || msg;
//           } catch (e) {}
//           MessageToast.show(msg);
//         }
//       });
//     }
//   });
// });
