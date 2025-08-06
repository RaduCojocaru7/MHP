sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent"
], function(Controller, UIComponent) {
  "use strict";
  return Controller.extend("fbtool.controller.ProfileInfo", {
        onInit: function() {
      var oUserModel = this.getOwnerComponent().getModel("loggedUser");
      if (oUserModel) {
        this.getView().setModel(oUserModel, "user");
      }
    },
    onNavBack: function() {
      var oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("UserDashboard");
    }
  });
});
