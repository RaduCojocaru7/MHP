sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent",
  "sap/m/MessageToast"
], function(Controller, JSONModel, UIComponent, MessageToast) {
  "use strict";
  return Controller.extend("fbtool.controller.PEGRequest", {
    onInit: function() {
      // Preia datele userului logat
      var oUserModel = this.getOwnerComponent().getModel("loggedUser");
      if (oUserModel) {
        this.getView().setModel(oUserModel, "user");
      }

      // PEG form model
      var oPEGModel = new JSONModel({
        currentDate: new Date().toISOString().slice(0, 10),
        managers: [
          { id: "mgr1", name: "Andrei Manager" },
          { id: "mgr2", name: "Maria Ionescu" }
        ],
        selectedManager: "mgr1",
        projects: [
          { id: "prj1", number: "10001" },
          { id: "prj2", number: "10002" }
        ],
        selectedProject: "prj1"
      });
      this.getView().setModel(oPEGModel, "peg");
    },

    onSendRequest: function() {
      MessageToast.show("PEG request sent!");
    },

    onExit: function() {
      var oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("UserDashboard");
    }
  });
});
