sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, Sorter, MessageToast) {
  "use strict";

  return Controller.extend("fbtool.controller.MyTeam", {

    onInit: function () {
      this._mgr = { id: "", name: "" };

      // (opțional, pentru debug Network): dezactivează batch ca să vezi GET clar
      // const oModel = this.getOwnerComponent().getModel("mainService");
      // if (oModel && oModel.setUseBatch) { oModel.setUseBatch(false); }

      this.getOwnerComponent().getRouter().getRoute("MyTeam")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this._resolveManagerInfo().then(function (oMgr) {
        this._mgr = oMgr || { id: "", name: "" };
        if (!this._mgr.name) {
          MessageToast.show("Nu pot identifica numele managerului logat.");
          console.warn("[MyTeam] Missing manager NAME. Resolved:", this._mgr);
          return;
        }
        console.log("[MyTeam] Manager:", this._mgr);
        this._applyFiltersSafely();
      }.bind(this));
    },

    onBack: function () {
      sap.ui.core.UIComponent.getRouterFor(this).navTo("ManagerDashboard");
    },

    /* — Aplică filtrul DUPĂ ce binding-ul există — */
    _applyFiltersSafely: function () {
      var oTable = this.byId("teamTable");
      var oBinding = oTable.getBinding("items");

      if (!oBinding) {
        oTable.attachEventOnce("updateFinished", this._applyFiltersSafely, this);
        return;
      }

      this._applyFilters();
      try { oBinding.refresh(true); } catch (e) {}
    },

    /* — Filtrare pe TEAM_MNGR = Nume Manager (cu fallback uppercase) — */
    _applyFilters: function () {
      var sName = (this._mgr.name || "").trim();
      if (!sName) { return; }

      var oTable   = this.byId("teamTable");
      var oBinding = oTable && oTable.getBinding("items");
      if (!oBinding) { return; }

      var sNameUp = sName.toUpperCase();

      // OR pe două variante: exact cum vine + UPPERCASE (în DB par salvate uppercase)
      var oFilterTeam = new Filter({
        and: false,
        filters: [
          new Filter("TEAM_MNGR", FilterOperator.EQ, sName),
          new Filter("TEAM_MNGR", FilterOperator.EQ, sNameUp)
        ]
      });

      console.log("[MyTeam] Applying filter TEAM_MNGR EQ", sName, "OR", sNameUp);
      oBinding.filter([oFilterTeam], "Application");
      oBinding.sort([ new Sorter("NAME", false) ]);

      oBinding.attachEventOnce("dataReceived", function (oEvent) {
        var resp = oEvent.getParameter("data");
        var len  = resp && resp.results ? resp.results.length : "unknown";
        console.log("[MyTeam] dataReceived. items:", len, resp);
      });
    },

    /* — Ia USER_ID + NAME manager: din loggedUser sau OData — */
    _resolveManagerInfo: function () {
      var oComp   = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");
      var oModel  = oComp.getModel("mainService");

      // 1) Din modelul loggedUser (setat la login)
      if (oLogged) {
        var id   = oLogged.getProperty("/user_id")  || oLogged.getProperty("/USER_ID")  || "";
        var name = oLogged.getProperty("/fullName") || oLogged.getProperty("/NAME")     || "";
        if (id || name) {
          try { if (id) localStorage.setItem("loggedUserId", id); } catch (e) {}
          return Promise.resolve({ id: id, name: name });
        }
      }

      // 2) Cache local pentru USER_ID (numele îl luăm din OData imediat)
      var cachedId = "";
      try { cachedId = localStorage.getItem("loggedUserId") || ""; } catch (e) {}

      // 3) Fallback: lookup după EMAIL -> NAME + USER_ID
      var email = oLogged && (oLogged.getProperty("/email") || oLogged.getProperty("/EMAIL")) || "";
      if (!email || !oModel) { return Promise.resolve({ id: cachedId, name: "" }); }

      return new Promise(function (resolve) {
        oModel.read("/UserSet", {
          filters: [ new Filter("EMAIL", FilterOperator.EQ, email.toUpperCase()) ],
          urlParameters: { "$select": "USER_ID,NAME" },
          success: function (oData) {
            var r    = (oData.results && oData.results[0]) || {};
            var id   = r.USER_ID || cachedId || "";
            var name = r.NAME    || "";
            if (oLogged) {
              if (id)   { oLogged.setProperty("/user_id", id); }
              if (name) { oLogged.setProperty("/fullName", name); }
            }
            try { if (id) localStorage.setItem("loggedUserId", id); } catch (e) {}
            resolve({ id: id, name: name });
          },
          error: function () { resolve({ id: cachedId, name: "" }); }
        });
      });
    }

  });
});