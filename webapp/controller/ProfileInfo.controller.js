sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/core/routing/History"
], function(Controller, UIComponent, History) {
  "use strict";

  return Controller.extend("fbtool.controller.ProfileInfo", {
    onInit: function () {
      var oUserModel = this.getOwnerComponent().getModel("loggedUser");
      if (oUserModel) {
        this.getView().setModel(oUserModel, "user");
      }
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1); // mergi înapoi la pagina anterioară din istoric
      } else {
        // fallback: dacă nu există istoric, du în dashboard potrivit
        var oUserModel = this.getOwnerComponent().getModel("loggedUser");
        var sRole = oUserModel?.getProperty("/role");

        if (sRole && sRole.toLowerCase() === "manager") {
          UIComponent.getRouterFor(this).navTo("ManagerDashboard");
        } else {
          UIComponent.getRouterFor(this).navTo("UserDashboard");
        }
      }
    }
  });
});
