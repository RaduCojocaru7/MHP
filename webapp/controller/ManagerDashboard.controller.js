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
        console.log("Manager dashboard initialized");
      } else {
        console.error("No manager logged in, redirecting to login...");
        this.getOwnerComponent().getRouter().navTo("Login");
      }
    },

    onLogout: function () {

      this.getOwnerComponent().setModel(null, "loggedUser");
      this.getView().setModel(null, "user");
  
      try {
        window.localStorage.removeItem("savedEmail");
        console.log("Cleared saved email from localStorage");
      } catch (e) {
        console.warn("Could not clear localStorage:", e);
      }
      
      var oLoginView = this.getOwnerComponent().byId("Login");
      if (oLoginView && oLoginView.getController && oLoginView.getController().clearInputs) {
        oLoginView.getController().clearInputs();
        console.log("Cleared login form inputs");
      }
      
      var oComponent = this.getOwnerComponent();
      var aModelNames = ["", "loggedUser", "user", "userModel"];
      aModelNames.forEach(function(sModelName) {
        var oModel = oComponent.getModel(sModelName);
        if (oModel) {
          oComponent.setModel(null, sModelName);
          console.log("Cleared model:", sModelName || "(default)");
        }
      });
      

      var oRouter = this.getOwnerComponent().getRouter();
      window.location.hash = "";
      
      setTimeout(function() {
        oRouter.navTo("Login", {}, true); 
        console.log("Navigated to Login page");
      }, 100);
      
      console.log("Logout process completed");
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
    },


    onNavFeedbackList: function () {
      var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
      oRouter.navTo("FeedbackList");
    },
    onNavigateToMyTeam: function () {
  this.getOwnerComponent().getRouter().navTo("MyTeam");
}

  });
});
