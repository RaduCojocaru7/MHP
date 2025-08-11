sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent",
  "sap/ui/model/Sorter"
], function (Controller, JSONModel, UIComponent, Sorter) {
  "use strict";

  return Controller.extend("fbtool.controller.PEGList", {

    onInit: function () {
      const oComp = this.getOwnerComponent();
      const oUserModel = oComp.getModel("loggedUser");
      const oPegListModel = oComp.getModel("pegList");

      if (!oUserModel || !oPegListModel) {
        UIComponent.getRouterFor(this).navTo("Login");
        return;
      }

      const sEmail = (oUserModel.getProperty("/email") || "").toLowerCase();
      const aAll = oPegListModel.getData(); // array din model/pegList.json

      // doar PEG-urile userului curent (case-insensitive)
      const aMine = (Array.isArray(aAll) ? aAll : []).filter(r =>
        (r.email || "").toLowerCase() === sEmail
      );

      // statusuri distincte (dinamic)
      const aStatusSet = new Set(aMine.map(r => r.status).filter(Boolean));
      const aStatuses = [{ key: "All", text: "All" }]
        .concat(Array.from(aStatusSet).sort().map(s => ({ key: s, text: s })));

      // model local pentru view
      const oLocal = new JSONModel({
        allRequests: aMine,     // sursă pentru filtrare
        requests: aMine,        // ce se afișează în listă
        statuses: aStatuses,    // pentru <Select>
        selectedStatus: "All"
      });
      this.getView().setModel(oLocal, "peg");

      // aplică grupare + sortare
      this._applyGrouping();
    },

    _applyGrouping: function () {
      const oList = this.byId("pegList");
      const oBinding = oList && oList.getBinding("items");
      if (!oBinding) return;

      // grupare după status
      const oGroupSorter = new Sorter("status", false, function (sStatus) {
        const s = sStatus || "Unknown";
        return { key: s, text: s };
      });

      // sortare secundară după createdDate desc (opțional)
      const oDateSorter = new Sorter("createdDate", true);

      oBinding.sort([oGroupSorter, oDateSorter]);
    },

    onStatusFilterChange: function (oEvent) {
      // pentru Select: parameterul se numește "selectedItem"
      const sKey = oEvent.getParameter("selectedItem")?.getKey()
                || oEvent.getSource().getSelectedKey();

      const oModel = this.getView().getModel("peg");
      const aAll = oModel.getProperty("/allRequests") || [];

      const aFiltered = (sKey === "All") ? aAll : aAll.filter(r => r.status === sKey);
      oModel.setProperty("/requests", aFiltered);

      // re-aplicăm gruparea după ce s-a schimbat colecția
      this._applyGrouping();
    },

    onNavBack: function () {
      const role = this.getOwnerComponent().getModel("loggedUser")?.getProperty("/role");
      const sTarget = (role && role.toLowerCase() === "manager") ? "ManagerDashboard" : "UserDashboard";
      UIComponent.getRouterFor(this).navTo(sTarget);
    }
  });
});
