sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("fbtool.controller.ManagerDashboard", {
    onInit: function () {
      const oUserModel = this.getOwnerComponent().getModel("loggedUser");

      if (oUserModel) {
        this.getView().setModel(oUserModel, "user");
        this.getView().getModel("user").refresh(true);
        console.log("✅ Manager dashboard initialized");
      } else {
        console.error("❌ No manager logged in, redirecting to login...");
        this.getOwnerComponent().getRouter().navTo("Login");
      }
    },

    onLogout: function () {
      this.getOwnerComponent().setModel(null, "loggedUser");

      var oLoginView = this.getOwnerComponent().byId("Login");
      if (oLoginView && oLoginView.getController && oLoginView.getController().clearInputs) {
        oLoginView.getController().clearInputs();
      }

      this.getOwnerComponent().getRouter().navTo("Login");
    },

    onNavigateTo360FB: function () {
      this.getOwnerComponent().getRouter().navTo("fb360");
    },

    onNavigateToPEG: function () {
      this.getOwnerComponent().getRouter().navTo("PEGRequest");
    },
    onProfileInfoPress: function () {
  this.getOwnerComponent().getRouter().navTo("ProfileInfo");
  },
onNavigateToFeedbackRequest: function () {
  var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
  oRouter.navTo("FeedbackRequest");
}

  });
});
