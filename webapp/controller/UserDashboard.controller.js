sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("fbtool.controller.UserDashboard", {
    onInit: function () {
      // Obține modelul utilizatorului logat
      const oUserModel = this.getOwnerComponent().getModel("loggedUser");
      
      if (oUserModel) {
        const oUserData = oUserModel.getData();
        console.log("👤 User dashboard loaded for:", oUserData);
        
        // Setează modelul pe view pentru data binding
        this.getView().setModel(oUserModel, "user");
      } else {
        console.error("❌ No logged user model found");
        // Redirectează înapoi la login dacă nu există utilizator logat
        this.getOwnerComponent().getRouter().navTo("Login");
      }
    },
    onLogout: function () {
      // Șterge modelul utilizatorului logat și redirecționează la login
      this.getOwnerComponent().setModel(null, "loggedUser");
      this.getOwnerComponent().getRouter().navTo("Login");
    },
    onNavigateTo360FB: function () {
      // Navighează către pagina 360FB
      this.getOwnerComponent().getRouter().navTo("fb360");
    },
    onProfileInfoPress: function () {
      // Navighează către view-ul ProfileInfo
      this.getOwnerComponent().getRouter().navTo("ProfileInfo");
    },
    onNavigateToPEG: function () {
      this.getOwnerComponent().getRouter().navTo("PEGRequest");
    }

  });
});