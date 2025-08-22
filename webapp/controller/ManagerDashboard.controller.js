sap.ui.define([

  "sap/ui/core/mvc/Controller",

  "sap/ui/model/json/JSONModel"

], function (Controller, JSONModel) {

  "use strict";
 
  return Controller.extend("fbtool.controller.ManagerDashboard", {

    onInit: function () {

      console.log("ManagerDashboard onInit - Starting...");

      this._setupUserModel();

      // Listen for route matched events

      var oRouter = this.getOwnerComponent().getRouter();

      oRouter.getRoute("ManagerDashboard").attachPatternMatched(this._onRouteMatched, this);

    },
 
    _onRouteMatched: function() {

      console.log("ManagerDashboard - Route matched, refreshing...");

      setTimeout(function() {

        this._setupUserModel();

      }.bind(this), 100);

    },
 
    _setupUserModel: function() {

      const oUserModel = this.getOwnerComponent().getModel("loggedUser");
 
      if (oUserModel) {

        var oData = oUserModel.getData();

        console.log("ManagerDashboard - LoggedUser data:", oData);

        if (!oData || !oData.email) {

          console.error("No valid user data, redirecting to login...");

          this.getOwnerComponent().getRouter().navTo("Login");

          return;

        }
 
        // Create fresh model instance

        var oFreshModel = new JSONModel(jQuery.extend(true, {}, oData));

        this.getView().setModel(oFreshModel, "user");

        oFreshModel.updateBindings(true);

        console.log("Manager dashboard initialized with user:", oData.fullName);

      } else {

        console.error("No manager logged in, redirecting to login...");

        this.getOwnerComponent().getRouter().navTo("Login");

      }

    },
 
    onLogout: function () {

      var oLoggedUserModel = this.getOwnerComponent().getModel("loggedUser");

      if (oLoggedUserModel) {

        oLoggedUserModel.setData({

          fullName: "",

          email: "",

          careerLevel: "",

          serviceUnit: "",

          personalNr: "",

          fiscalYear: "",

          role: "",

          userId: "",

          teamManager: ""

        });

        console.log("Cleared loggedUser data");

      }
 
      this.getOwnerComponent().getRouter().navTo("Login");

      console.log("Logout completed - navigated to Login");

    },
 
    onNavigateTo360FB: function () {

      this.getOwnerComponent().getRouter().navTo("fb360");

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
 
    onNavPEGList: function () {

      var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

      oRouter.navTo("PEGList");

    },

    onNavigateToMyTeam: function () {

        this.getOwnerComponent().getRouter().navTo("MyTeam");

    },

    onNavigateToPegEdit: function () {
     
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("ManagerPegEdit");
    },

 
    onExit: function() {

      var oRouter = this.getOwnerComponent().getRouter();

      if (oRouter && oRouter.getRoute("ManagerDashboard")) {

        oRouter.getRoute("ManagerDashboard").detachPatternMatched(this._onRouteMatched, this);

      }

}
 
  });

});
 