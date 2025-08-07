sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent"
], function(Controller, JSONModel, UIComponent) {
  "use strict";

  return Controller.extend("fbtool.controller.PEGList", {

    onInit: function () {
      const oUserModel = this.getOwnerComponent().getModel("loggedUser");

      if (!oUserModel) {
        console.warn("\u26A0\uFE0F No logged user model found. Redirecting...");
        UIComponent.getRouterFor(this).navTo("Login");
        return;
      }

      const userEmail = oUserModel.getProperty("/email");
      const oPEGModel = this.getOwnerComponent().getModel("pegList");
      const aAllRequests = oPEGModel?.getData() || [];

      const aUserRequests = aAllRequests.filter(req => req.email?.toLowerCase() === userEmail?.toLowerCase());
      this._allUserRequests = aUserRequests;

      const oFilteredModel = new JSONModel({
        requests: aUserRequests.filter(req => req.status === "Pending")
      });

      this.getView().setModel(oFilteredModel, "peg");
    },

    onFilterChange: function (oEvent) {
      const sKey = oEvent.getParameter("selectedItem").getKey();
      const oModel = this.getView().getModel("peg");

      if (!this._allUserRequests) return;

      const filtered = sKey === "All"
        ? this._allUserRequests
        : this._allUserRequests.filter(req => req.status === sKey);

      oModel.setProperty("/requests", filtered);
    },

    onNavBack: function () {
      const oUserModel = this.getOwnerComponent().getModel("loggedUser");
      const role = oUserModel?.getProperty("/role");
      const sTarget = (role && role.toLowerCase() === "manager") ? "ManagerDashboard" : "UserDashboard";
      UIComponent.getRouterFor(this).navTo(sTarget);
    }

  });
});