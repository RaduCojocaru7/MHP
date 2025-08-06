sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("fbtool.controller.ForgotPassword", {
    onInit: function () {
      // init logic dacă e nevoie
    },

    onRequestPassword: function () {
      var email = this.getView().byId("forgotEmailInput").getValue();
      if (email) {
        // Aici ai putea face un request spre backend
        sap.m.MessageToast.show("Password reset link sent to " + email);
      } else {
        sap.m.MessageToast.show("Please enter your email address.");
      }
    },
    onBackToLogin: function () {
  var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
  oRouter.navTo("Login"); // Asigură-te că ruta e declarată în manifest
    }
  });
});
