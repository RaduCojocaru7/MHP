sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("fbtool.controller.FB360", {
    onInit: function () {
      // Încarcă modelul cu useri, dacă ai unul
    },

    onSendFeedback: function () {
      sap.m.MessageToast.show("Feedback sent (placeholder)");
    },

    onExit: function () {
      // Navighează către dashboard-ul potrivit în funcție de rol
      var oComponent = this.getOwnerComponent();
      var oUserModel = oComponent.getModel("loggedUser");
      var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      
      // Verifică dacă există un utilizator logat și determină rolul din userData
      var oUserDataModel = oComponent.getModel("userData");
      if (oUserModel && oUserDataModel) {
        var loggedUserData = oUserModel.getData();
        var allUsers = oUserDataModel.getData();
        
        // Găsește utilizatorul complet din userData pe baza email-ului
        var currentUser = allUsers.find(function(user) {
          return user.email && user.email.toLowerCase() === loggedUserData.email.toLowerCase();
        });
        
        if (currentUser && currentUser.role && currentUser.role.toLowerCase() === "manager") {
          oRouter.navTo("ManagerDashboard");
        } else {
          oRouter.navTo("UserDashboard");
        }
      } else {
        oRouter.navTo("Login");
      }
    }
  });
});
