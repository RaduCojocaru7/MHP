sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent"
], function (Controller, JSONModel, UIComponent) {
  "use strict";

  return Controller.extend("fbtool.controller.PEGList", {
    onInit: function () {
  const oUserModel = this.getOwnerComponent().getModel("loggedUser");
  const pegListModel = this.getOwnerComponent().getModel("pegList");

  if (!oUserModel || !pegListModel) {
    console.warn("Missing model(s).");
    return;
  }

  const userEmail = oUserModel.getProperty("/email");
  const allRequests = pegListModel.getData(); // din JSON-ul extern

  const userRequests = allRequests.filter(req => req.email === userEmail);
  this._allUserRequests = userRequests;

  const oModel = new JSONModel({
    requests: userRequests // inițial toate, filtrate în UI
  });
  this.getView().setModel(oModel, "peg");
}
,

    onFilterChange: function (oEvent) {
  const sKey = oEvent.getParameter("item")?.getKey(); // folosește `.item` dacă nu merge `.selectedItem`

  if (!this._allUserRequests || !sKey) return;

  const filtered = sKey === "All"
    ? this._allUserRequests
    : this._allUserRequests.filter(req => req.status === sKey);

  const oModel = this.getView().getModel("peg");
  oModel.setProperty("/requests", filtered);
}

,

    onNavBack: function () {
      const role = this.getOwnerComponent().getModel("loggedUser")?.getProperty("/role");
      const sTarget = role === "manager" ? "ManagerDashboard" : "UserDashboard";
      UIComponent.getRouterFor(this).navTo(sTarget);
    }
  });
});
