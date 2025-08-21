sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent", 
  "sap/ui/core/routing/History",
  "sap/ui/model/json/JSONModel"  
], function(Controller, UIComponent, History, JSONModel) {
  "use strict";

  return Controller.extend("fbtool.controller.ProfileInfo", {
    onInit: function () {
      this._refreshUserModel();
      
      var oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("ProfileInfo").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function() {
      setTimeout(function() {
        this._refreshUserModel();
      }.bind(this), 100);
    },

    onBeforeRendering: function() {
      this._refreshUserModel();
    },

    onAfterRendering: function() {
      var oUserModel = this.getView().getModel("user");
      if (oUserModel) {
        oUserModel.updateBindings(true);
      } else {
        this._refreshUserModel();
      }
    },

    _refreshUserModel: function() {
      var oLoggedUserModel = this.getOwnerComponent().getModel("loggedUser");
      if (oLoggedUserModel) {
        var oData = oLoggedUserModel.getData();

        if (!oData || !oData.email || !oData.fullName) {
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
        
        return true;
      } else {
        return false;
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
          UIComponent.getRouterFor(this).navTo("Login");
          return;
        }

        var sRole = oUserModel.getProperty("/role");

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