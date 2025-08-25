sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast) {
  "use strict";

  return Controller.extend("fbtool.controller.EmployeeList", {

    onInit: function () {

      var oEmployeeModel = new JSONModel({ employees: [] });
      this.getView().setModel(oEmployeeModel, "employeeModel");

      this._loadEmployees();
    },

    _loadEmployees: function () {
      var oModel = this.getOwnerComponent().getModel("mainService");
      if (!oModel) {
        MessageToast.show("Service model not available!");
        return;
      }

      oModel.read("/UserSet", {
        urlParameters: {
          "$select": "USER_ID,NAME,EMAIL,PERSONAL_NR,CAREER_LV,SU,TEAM_MNGR"
        },
        success: function (oData) {
          var aEmployees = (oData.results || []).map(function (u) {
            return {
              name: u.NAME || "",
              email: u.EMAIL || "",
              personalNr: u.PERSONAL_NR || "",
              careerLevel: u.CAREER_LV || "",
              su: u.SU || "",
              manager: u.TEAM_MNGR || ""
            };
          });
          this.getView().getModel("employeeModel").setProperty("/employees", aEmployees);
        }.bind(this),
        error: function (err) {
          MessageToast.show("Eroare la încărcarea userilor.");
          console.error(err);
        }
      });
    },

    onSearch: function(oEvent) {
    this._applyFilters();
    },

    onFilterChange: function(oEvent) {
        this._applyFilters();
    },

    _applyFilters: function() {
        var oTable = this.byId("employeeTable");
        var oBinding = oTable.getBinding("items");
        if (!oBinding) return;

        var sName = this.byId("employeeSearch").getValue().trim();
        var sCareer = this.byId("careerFilter").getSelectedKey();
        var sSU = this.byId("suFilter").getSelectedKey();
        var sManager = this.byId("managerFilter").getSelectedKey();

        var aFilters = [];

        if (sName) {
            aFilters.push(new Filter("name", FilterOperator.Contains, sName));
        }
        if (sCareer) {
            aFilters.push(new Filter("careerLevel", FilterOperator.EQ, sCareer));
        }
        if (sSU) {
            aFilters.push(new Filter("su", FilterOperator.EQ, sSU));
        }
        if (sManager) {
            aFilters.push(new Filter("manager", FilterOperator.EQ, sManager));
        }

        oBinding.filter(aFilters, "Application");  
    },


    onRefresh: function () {
      this._loadEmployees();
      MessageToast.show("Employee list refreshed.");
    },

    onNavBack: function () {
      sap.ui.core.UIComponent.getRouterFor(this).navTo("HRDashboard");
    }

  });
});
