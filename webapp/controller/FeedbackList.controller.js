sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter"
], function (Controller, History, Filter, FilterOperator, Sorter) {
  "use strict";

  return Controller.extend("fbtool.controller.FeedbackList", {
    onInit: function () {
      // aplică setări inițiale (ex: grupare după status)
      this._applyListBinding();
    },

    onNavBack: function () {
      const h = History.getInstance();
      if (h.getPreviousHash() !== undefined) { history.go(-1); return; }

      const oLU = this.getOwnerComponent().getModel("loggedUser");
      const role = (oLU && oLU.getProperty("/role") || "").toLowerCase();
      const r = this.getOwnerComponent().getRouter();
      if (role === "manager")      { r.navTo("ManagerDashboard", {}, true); }
      else if (role === "hr")      { r.navTo("HRDashboard", {}, true); }
      else                         { r.navTo("UserDashboard", {}, true); }
    },

    onStatusFilterChange: function (oEvent) {
      const sKey = oEvent.getParameter("selectedItem").getKey(); // "", "open", "closed", etc.
      const oBinding = this.byId("lstFeedback").getBinding("items");
      if (!oBinding) { return; }

      const aFilters = [];
      if (sKey) {
        aFilters.push(new Filter("status", FilterOperator.EQ, sKey));
      }
      oBinding.filter(aFilters);

      // păstrăm și sortarea/gruparea
      this._applyListBinding();
    },

    _applyListBinding: function () {
      const oBinding = this.byId("lstFeedback").getBinding("items");
      if (!oBinding) { return; }

      // sortare după status (asc) apoi după dată (desc)
      const aSorters = [
        new Sorter("status", false /* ascending */, /* group= */ true),
        new Sorter("createdAt", true /* descending */)
      ];
      oBinding.sort(aSorters);
    }
  });
});
