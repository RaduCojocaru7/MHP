sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("fbtool.controller.HRDashboard", {
    onInit: function () {
      var oView = this.getView();

      this.getView().addEventDelegate({
        onBeforeShow: function () {
          const oUserModel = this.getOwnerComponent().getModel("loggedUser");

          if (oUserModel) {
            oView.setModel(oUserModel, "user");
            oUserModel.refresh(true);
            console.log("Model refreshed and bound to HRDashboard");
          } else {
            console.error("No logged user model, redirecting...");
            this.getOwnerComponent().getRouter().navTo("Login");
          }
        }.bind(this)
      });
    },

    onLogout: function () {
      var oComp = this.getOwnerComponent();
      oComp.setModel(null, "loggedUser");

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
      console.log("Navigating to PEGList…");
      this.getOwnerComponent().getRouter().navTo("PEGList");
    },

    onNavigateToEmployeeList: function () {
      console.log("Navigating to EmployeeList…");
      this.getOwnerComponent().getRouter().navTo("EmployeeList");
    },


  });
});