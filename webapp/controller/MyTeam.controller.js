sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel"
], function (Controller, Filter, FilterOperator, Sorter, MessageToast, Fragment, JSONModel) {
  "use strict";

  return Controller.extend("fbtool.controller.MyTeam", {

    onInit: function () {
      this._mgr = { id: "", name: "" };

      // Încearcă să ruleze filtrarea când intri pe rută (dacă există)
      var oRouter = this.getOwnerComponent().getRouter();
      if (oRouter.getRoute("MyTeam")) {
        oRouter.getRoute("MyTeam").attachPatternMatched(this._onRouteMatched, this);
      } else {
        // fallback: aplică imediat
        this._onRouteMatched();
      }
    },

    _onRouteMatched: function () {
      this._resolveManagerInfo().then(function (oMgr) {
        this._mgr = oMgr || { id: "", name: "" };
        if (!this._mgr.name) {
          MessageToast.show("Nu pot identifica numele managerului logat.");
          return;
        }
        this._applyFiltersSafely();
      }.bind(this));
    },

    onBack: function () {
      sap.ui.core.UIComponent.getRouterFor(this).navTo("ManagerDashboard");
    },

    /* --- Aplică filtrul DUPĂ ce binding-ul există + (nou) leagă dublu-click --- */
    _applyFiltersSafely: function () {
      var oTable = this.byId("teamTable");
      var oBinding = oTable && oTable.getBinding("items");

      if (!oBinding) {
        oTable.attachEventOnce("updateFinished", this._applyFiltersSafely, this);
        return;
      }

      this._applyFilters();

      try { oBinding.refresh(true); } catch (e) {}

      // (nou) atașăm handlerul de dublu-click de fiecare dată când se populează items
      oTable.detachUpdateFinished(this._wireDblClickForItems, this);
      oTable.attachUpdateFinished(this._wireDblClickForItems, this);
      this._wireDblClickForItems();
    },

    /* --- Filtru pe TEAM_MNGR = Nume Manager (cu fallback UPPER) --- */
    _applyFilters: function () {
      var sName = (this._mgr.name || "").trim();
      if (!sName) { return; }

      var oTable   = this.byId("teamTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) { return; }

      var sNameUp = sName.toUpperCase();

      var oFilterTeam = new Filter({
        and: false,
        filters: [
          new Filter("TEAM_MNGR", FilterOperator.EQ, sName),
          new Filter("TEAM_MNGR", FilterOperator.EQ, sNameUp)
        ]
      });

      oBinding.filter([oFilterTeam], "Application");
      oBinding.sort([ new Sorter("NAME", false) ]);
    },

    /* --- Ia USER_ID + NAME manager (din loggedUser sau OData) --- */
    _resolveManagerInfo: function () {
      var oComp   = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");
      var oModel  = oComp.getModel("mainService");

      if (oLogged) {
        var id   = oLogged.getProperty("/user_id")  || oLogged.getProperty("/USER_ID")  || "";
        var name = oLogged.getProperty("/fullName") || oLogged.getProperty("/NAME")     || "";
        if (id || name) {
          try { if (id) localStorage.setItem("loggedUserId", id); } catch (e) {}
          return Promise.resolve({ id: id, name: name });
        }
      }

      var cachedId = "";
      try { cachedId = localStorage.getItem("loggedUserId") || ""; } catch (e) {}

      var email = oLogged && (oLogged.getProperty("/email") || oLogged.getProperty("/EMAIL")) || "";
      if (!email || !oModel) { return Promise.resolve({ id: cachedId, name: "" }); }

      return new Promise(function (resolve) {
        oModel.read("/UserSet", {
          filters: [ new Filter("EMAIL", FilterOperator.EQ, email.toUpperCase()) ],
          urlParameters: { "$select": "USER_ID,NAME" },
          success: function (oData) {
            var r = (oData && oData.results && oData.results[0]) || null;
            var id = r && r.USER_ID || cachedId || "";
            var name = r && r.NAME || "";
            try { if (id) localStorage.setItem("loggedUserId", id); } catch (e) {}
            resolve({ id: id, name: name });
          },
          error: function () { resolve({ id: cachedId, name: "" }); }
        });
      });
    },

    /* ===================== DUBLUL-CLICK + DIALOG ===================== */

    _wireDblClickForItems: function () {
      var oTable = this.byId("teamTable");
      if (!oTable) { return; }

      oTable.getItems().forEach(function (oItem) {
        if (oItem.__dblBound) { return; }
        oItem.__dblBound = true;

        oItem.addEventDelegate({
          ondblclick: function () {
            this._onItemDblClick(oItem);
          }.bind(this)
        }, this);
      }.bind(this));
    },

   _onItemDblClick: function (oItem) {
  // 1) ia obiectul exact al rândului (din OData "mainService")
  var oCtx  = oItem.getBindingContext("mainService") || oItem.getBindingContext();
  if (!oCtx) {
    console.error("[MyTeam] No binding context on item");
    return;
  }
  var oData = oCtx.getObject();
  if (!oData) {
    console.error("[MyTeam] No data on context", oCtx.getPath());
    return;
  }

  // 2) model local pentru dialog (moștenit de fragment prin addDependent)
  if (!this._selectedUserModel) {
    this._selectedUserModel = new sap.ui.model.json.JSONModel({});
    this._selectedUserModel.setDefaultBindingMode("TwoWay");
    this.getView().setModel(this._selectedUserModel, "selectedUser");
  }

  // 3) inițiale (opțional)
  var initials = "";
  if (oData.NAME) {
    initials = oData.NAME.trim().split(/\s+/).map(function (s) { return s[0]; })
      .join("").toUpperCase().slice(0, 2);
  }

  // 4) MAPARE OData -> camelCase (la fel ca în ProfileInfo)
var oPayload = {
  fullName:    oData.NAME,
  email:       oData.EMAIL,
  personalNr:  oData.PERSONAL_NR,
  serviceUnit: oData.SU,
  role:        oData.ROLE,
  careerLevel: oData.CAREER_LV,   // sau CAREER_LVL dacă așa vine la tine
  fiscalYear:  oData.FISCAL_YR,
  initials:    initials
};
// ... ai deja oPayload cu fullName, email, personalNr, serviceUnit, role, careerLevel, fiscalYear, initials
this._selectedUserModel.setData(oPayload);
console.log("[MyTeam] selectedUser payload:", this._selectedUserModel.getData());

if (!this._oTeamDialog) {
  sap.ui.core.Fragment.load({
    id: this.getView().getId(),
    name: "fbtool.view.TeamMemberDialog",
    controller: this
  }).then(function (oDialog) {
    this._oTeamDialog = oDialog;
    this.getView().addDependent(oDialog);
    // important: atașează explicit modelul la Dialog
    this._oTeamDialog.setModel(this._selectedUserModel, "selectedUser");
    this._oTeamDialog.open();
  }.bind(this));
} else {
  // reîmprospătează modelul pe dialog (în caz că s-a schimbat)
  this._oTeamDialog.setModel(this._selectedUserModel, "selectedUser");
  this._oTeamDialog.open();
}

}

,

    onCloseTeamDialog: function () {
      if (this._oTeamDialog) {
        this._oTeamDialog.close();
      }
    }

  });
});
