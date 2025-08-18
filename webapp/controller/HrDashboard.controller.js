sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("fbtool.controller.HRDashboard", {
    onInit: function () {
      const oUserModel = this.getOwnerComponent().getModel("loggedUser");
      if (oUserModel) {
        this.getView().setModel(oUserModel, "user");
      } else {
        this.getOwnerComponent().getRouter().navTo("Login");
      }
    },

    onLogout: function () {
      // păstrează emailul pentru pre-populare, curăță parola
      var oComp = this.getOwnerComponent();
      oComp.setModel(null, "loggedUser");

      // încearcă să golești parola din login view dacă e încărcată
      var oLoginView = oComp.byId("Login");
      if (oLoginView && oLoginView.getController && oLoginView.getController().clearInputs) {
        oLoginView.getController().clearInputs();
      }

      oComp.getRouter().navTo("Login");
    },

    onProfileInfoPress: function () {
      this.getOwnerComponent().getRouter().navTo("ProfileInfo");
    },

    onNavigateToPEGList: function () {
      this.getOwnerComponent().getRouter().navTo("PEGList");
    },

    onNavigateToEmployeeList: function () {
      this.getOwnerComponent().getRouter().navTo("EmployeeList");
    }
  });
});
