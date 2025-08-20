sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent", 
  "sap/ui/core/routing/History",
  "sap/ui/model/json/JSONModel"  
], function(Controller, UIComponent, History, JSONModel) {
  "use strict";

  return Controller.extend("fbtool.controller.ProfileInfo", {
    onInit: function () {
      console.log("ProfileInfo onInit - Starting...");
      this._refreshUserModel();
      
      var oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("ProfileInfo").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function() {
      console.log("ProfileInfo - Route matched, refreshing user model...");
      setTimeout(function() {
        this._refreshUserModel();
      }.bind(this), 100);
    },

    onBeforeRendering: function() {
      console.log("ProfileInfo onBeforeRendering - Refreshing user model...");
      this._refreshUserModel();
    },

    onAfterRendering: function() {
      console.log("ProfileInfo onAfterRendering - Final model check...");
      var oUserModel = this.getView().getModel("user");
      if (oUserModel) {
        oUserModel.updateBindings(true);
        console.log("ProfileInfo - After rendering, user data:", oUserModel.getData());
      } else {
        console.error("ProfileInfo - No user model found in view after rendering");

        this._refreshUserModel();
      }
    },

    _refreshUserModel: function() {

      var oLoggedUserModel = this.getOwnerComponent().getModel("loggedUser");
      if (oLoggedUserModel) {
  
        var oData = oLoggedUserModel.getData();
        console.log("ProfileInfo - Original loggedUser data:", oData);

        if (!oData || !oData.email || !oData.fullName) {
          console.warn("ProfileInfo - loggedUser model exists but has no valid data");
          return false;
        }

        var oFreshModel = new JSONModel(jQuery.extend(true, {}, oData));
        oFreshModel.setSizeLimit(1000);
        oFreshModel.setDefaultBindingMode("TwoWay");

        var oOldModel = this.getView().getModel("user");
        if (oOldModel) {
          this.getView().setModel(null, "user");
        }

        this.getView().setModel(oFreshModel, "user");

        setTimeout(function() {
          oFreshModel.updateBindings(true);
        }, 50);
        
        console.log("ProfileInfo - Fresh user model set:", oFreshModel.getData());
        return true;
      } else {
        console.error("ProfileInfo - No loggedUser model found in component");
        return false;
      }
    },

    onExit: function() {

      var oRouter = this.getOwnerComponent().getRouter();
      if (oRouter && oRouter.getRoute("ProfileInfo")) {
        oRouter.getRoute("ProfileInfo").detachPatternMatched(this._onRouteMatched, this);
      }
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {

        var oUserModel = this.getOwnerComponent().getModel("loggedUser");
        
        if (!oUserModel) {
          console.error("ProfileInfo - No loggedUser model found during navigation");

          UIComponent.getRouterFor(this).navTo("Login");
          return;
        }

        var sRole = oUserModel.getProperty("/role");
        console.log("ProfileInfo - User role:", sRole);

        if (sRole && sRole.toLowerCase() === "manager") {
          UIComponent.getRouterFor(this).navTo("ManagerDashboard");
        } else if (sRole && sRole.toLowerCase() === "hr") {
          UIComponent.getRouterFor(this).navTo("HRDashboard");
        } else {
          UIComponent.getRouterFor(this).navTo("UserDashboard");
        }
      }
    }
  });
});