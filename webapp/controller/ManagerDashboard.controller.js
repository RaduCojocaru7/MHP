sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";
  return Controller.extend("fbtool.controller.ManagerDashboard", {
    onInit: function () {
      // Obține modelul utilizatorului logat (manager)
      const oUserModel = this.getOwnerComponent().getModel("loggedUser");
      if (oUserModel) {
        const oUserData = oUserModel.getData();
        console.log("👤 Manager dashboard loaded for:", oUserData);
        // Setează modelul pe view pentru data binding
        this.getView().setModel(oUserModel, "user");
      } else {
        console.error("❌ No logged user model found");
        // Redirectează înapoi la login dacă nu există utilizator logat
        this.getOwnerComponent().getRouter().navTo("Login");
      }

      // Creează modelul pentru membrii echipei
      var oTeamModel = new sap.ui.model.json.JSONModel({
        teamMembers: [
          { name: "Alex", surname: "Popescu", careerLevel: "JUNIOR" },
          { name: "Maria", surname: "Ionescu", careerLevel: "SENIOR" },
          { name: "Stefania", surname: "Maracine", careerLevel: "INTERN" }
        ]
      });
      this.getView().setModel(oTeamModel);
    },
    onLogout: function () {
      // Șterge modelul utilizatorului logat și redirecționează la login
      this.getOwnerComponent().setModel(null, "loggedUser");
      // Golește input-urile de login dacă controllerul este încărcat
      var oLoginView = this.getOwnerComponent().byId("Login");
      if (oLoginView && oLoginView.getController && oLoginView.getController().clearInputs) {
        oLoginView.getController().clearInputs();
      }
      this.getOwnerComponent().getRouter().navTo("Login");
    },
    onTeamFeedback: function () {
      sap.m.MessageToast.show("Team feedback request form not implemented yet.");
    },
    onNavigateTo360FB: function () {
      // Navighează către pagina 360FB
      this.getOwnerComponent().getRouter().navTo("fb360");
    },
    onMyTeam: function () {
      // Toggle vizibilitatea secțiunii My Team
      var oTeamSection = this.byId("myTeamSection");
      var bVisible = oTeamSection.getVisible();
      oTeamSection.setVisible(!bVisible);
    }
  });
});
