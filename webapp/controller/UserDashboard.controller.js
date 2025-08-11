sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("fbtool.controller.UserDashboard", {
    onInit: function () {
      var oView = this.getView();

      // Când view-ul e afișat, refacem legarea modelului
      this.getView().addEventDelegate({
        onBeforeShow: function () {
          const oUserModel = this.getOwnerComponent().getModel("loggedUser");

          if (oUserModel) {
            oView.setModel(oUserModel, "user");
            oUserModel.refresh(true);
            console.log("🔁 Model refreshed and bound to UserDashboard");
          } else {
            console.error("❌ No logged user model, redirecting...");
            this.getOwnerComponent().getRouter().navTo("Login");
          }
        }.bind(this)
      });
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

    onProfileInfoPress: function () {
      this.getOwnerComponent().getRouter().navTo("ProfileInfo");
    },

    onNavigateToPEG: function () {
      this.getOwnerComponent().getRouter().navTo("PEGRequest");
    },
       onNavigateToPEGList: function () {
  console.log("Navigating to PEGList…");
  this.getOwnerComponent().getRouter().navTo("PEGList");
}
  });
});
