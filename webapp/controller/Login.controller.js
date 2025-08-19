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

    getLogoSrc: function () {
  // Rezolvare corectă în FLP și local
  var s = sap.ui.require.toUrl("fbtool/img/mhp-logo.png");
  // (opțional) debug:
  // console.log("Logo path:", s);
  return s;
}
,
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
