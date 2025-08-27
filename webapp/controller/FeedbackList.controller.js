sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageToast) {
  "use strict";
 
  return Controller.extend("fbtool.controller.FeedbackList", {
 
    onInit: function () {
      this._sMode    = "received";                
      this._sQuery   = "";
      this._sUserId  = "";
      this._userById = Object.create(null);       
      this._typeById = Object.create(null);       
      this._projById = Object.create(null);
      
      // Debouncing properties
      this._filterTimeout = null;
      this._initTimeout = null;

      // Curăță cache-ul vechi
      try {
        localStorage.removeItem("loggedUserId");
      } catch (e) {}
      
      // Setup listener pentru schimbări în modelul loggedUser
      var oComp = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");
      if (oLogged) {
        oLogged.attachPropertyChange(this._onLoggedUserChanged, this);
      }

      this._initializeFeedbackList();
      
      // Verifică periodic dacă utilizatorul s-a schimbat (redus la 3 secunde)
      this._userCheckInterval = setInterval(function() {
        this._checkForUserChange();
      }.bind(this), 3000);
    },

    // Verifică dacă utilizatorul s-a schimbat și actualizează automat
    _checkForUserChange: function() {
      var oComp = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");
      var currentModelUserId = oLogged ? oLogged.getProperty("/userId") : "";
      
      if (currentModelUserId && currentModelUserId !== this._sUserId) {
        this._sUserId = currentModelUserId;
        try { 
          localStorage.setItem("loggedUserId", currentModelUserId); 
        } catch (e) {}
        this._applyFilters();
      }
    },

    // Inițializarea listei de feedback cu debouncing
    _initializeFeedbackList: function() {
      if (this._initTimeout) {
        clearTimeout(this._initTimeout);
      }
      
      this._initTimeout = setTimeout(function() {
        this._doInitializeFeedbackList();
      }.bind(this), 200);
    },

    _doInitializeFeedbackList: function() {
      this._checkForUserChange();
      
      Promise.all([
        this._loadUserNames(),
        this._loadTypeNames(),
        this._loadProjectNames()
      ]).then(function () {
        return this._resolveFromUserId();
      }.bind(this)).then(function (sUserId) {
        this._sUserId = sUserId || "";
        
        if (!this._sUserId) {
          MessageToast.show("Nu pot identifica utilizatorul logat.");
          return;
        }
        
        var oSel = this.byId("modeSelect");
        if (oSel && oSel.getSelectedKey() !== this._sMode) {
          oSel.setSelectedKey(this._sMode);
        }
        
        // Aplicăm filtrele cu debouncing
        this._applyFilters();
        
      }.bind(this));
    },

    // Handler pentru schimbări în modelul loggedUser
    _onLoggedUserChanged: function(oEvent) {
      var sProperty = oEvent.getParameter("path");
      var newValue = oEvent.getParameter("value");
      
      if (sProperty === "/userId" && newValue !== this._sUserId) {
        this._resetControllerState();
        this._initializeFeedbackList();
      }
    },
 
    /* ===== Lookups ===== */
    _loadUserNames: function () {
      var oModel = this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { resolve(); return; }
        oModel.read("/UserSet", {
          urlParameters: { "$select": "USER_ID,NAME" },
          success: function (oData) {
            var map = Object.create(null);
            (oData.results || []).forEach(function (u) {
              if (u.USER_ID) { map[u.USER_ID] = u.NAME || u.USER_ID; }
            });
            this._userById = map;
            resolve();
          }.bind(this),
          error: function () { resolve(); }
        });
      }.bind(this));
    },
 
    _loadTypeNames: function () {
      var oModel = this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { resolve(); return; }
        oModel.read("/Feedback_TypeSet", {
          urlParameters: { "$select": "FB_TYPE_ID,TYPE" },
          success: function (oData) {
            var map = Object.create(null);
            (oData.results || []).forEach(function (t) {
              if (t.FB_TYPE_ID) { map[t.FB_TYPE_ID] = t.TYPE || t.FB_TYPE_ID; }
            });
            this._typeById = map;
            resolve();
          }.bind(this),
          error: function () { resolve(); }
        });
      }.bind(this));
    },
 
    _loadProjectNames: function () {
      var oModel = this.getOwnerComponent().getModel("mainService");
      return new Promise(function (resolve) {
        if (!oModel) { resolve(); return; }
        oModel.read("/User_ProjectsSet", {
          urlParameters: { "$select": "PROJ_ID,PROJ_NAME" },
          success: function (oData) {
            var map = Object.create(null);
            (oData.results || []).forEach(function (p) {
              if (p.PROJ_ID && p.PROJ_NAME && !map[p.PROJ_ID]) {
                map[p.PROJ_ID] = p.PROJ_NAME;
              }
            });
            this._projById = map;
            resolve();
          }.bind(this),
          error: function () { resolve(); }
        });
      }.bind(this));
    },
 
    /* ===== Filtering core cu debouncing ===== */
    _applyFilters: function () {
      // Anulează timeout-ul precedent
      if (this._filterTimeout) {
        clearTimeout(this._filterTimeout);
      }
      
      // Setează un delay pentru a evita request-urile multiple
      this._filterTimeout = setTimeout(function() {
        this._doApplyFilters();
      }.bind(this), 300); // 300ms delay
    },

    // Logica reală de filtrare
    _doApplyFilters: function () {
      var oComp = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");
      var currentModelUserId = oLogged ? oLogged.getProperty("/userId") : "";
      
      if (currentModelUserId && currentModelUserId !== this._sUserId) {
        this._sUserId = currentModelUserId;
        try { 
          localStorage.setItem("loggedUserId", currentModelUserId); 
        } catch (e) {}
      }
      
      var oList = this.byId("fbList");
      var oBinding = oList && oList.getBinding("items");
      
      if (!oBinding || !this._sUserId) {
        return; 
      }

      // Asigură-te că USER_ID are padding corect (003 în loc de 3)
      var userIdForFilter = this._normalizePadding(this._sUserId);
      var aFilters = [];

      if (this._sMode === "received") {
        aFilters.push(new Filter("TO_USER_ID", FilterOperator.EQ, userIdForFilter));
      } else {
        aFilters.push(new Filter("FROM_USER_ID", FilterOperator.EQ, userIdForFilter));
      }

      if (this._sQuery && this._sQuery.trim()) {
        aFilters.push(new Filter("INPUT_TEXT", FilterOperator.Contains, this._sQuery.trim()));
      }

      oBinding.filter(aFilters, "Application");
    },

    _clearFeedbackList: function() {
      var oList = this.byId("fbList");
      var oBinding = oList && oList.getBinding("items");
      if (oBinding) {
        oBinding.filter([], "Application");
      }
    },

    _changeUser: function(sNewUserId) {
      this._clearFeedbackList();
      this._sUserId = sNewUserId || "";
      this._sQuery = "";
      this._applyFilters();
    },

    _resetControllerState: function() {
      this._sMode = "received";
      this._sQuery = "";
      this._sUserId = "";
      
      try {
        localStorage.removeItem("loggedUserId");
        localStorage.removeItem("loggedEmail");
      } catch (e) {}
      
      this._clearFeedbackList();
      
      var oSel = this.byId("modeSelect");
      if (oSel) {
        oSel.setSelectedKey("received");
      }
    },

    // Cleanup cu timeout-uri
    onExit: function() {
      if (this._userCheckInterval) {
        clearInterval(this._userCheckInterval);
        this._userCheckInterval = null;
      }
      
      if (this._filterTimeout) {
        clearTimeout(this._filterTimeout);
        this._filterTimeout = null;
      }
      
      if (this._initTimeout) {
        clearTimeout(this._initTimeout);
        this._initTimeout = null;
      }
      
      var oComp = this.getOwnerComponent();
      var oLogged = oComp && oComp.getModel("loggedUser");
      if (oLogged) {
        oLogged.detachPropertyChange(this._onLoggedUserChanged, this);
      }
    },

    /* ===== UI handlers ===== */
    onModeSelectChange: function (oEvent) {
      var sKey = oEvent.getSource().getSelectedKey();
      this._sMode = (sKey === "sent") ? "sent" : "received";
      
      // Forțează refresh-ul pentru a actualiza vizibilitatea câmpurilor Anonymous
      var oList = this.byId("fbList");
      var oBinding = oList && oList.getBinding("items");
      if (oBinding) {
        // Salvează filtrele curente
        var aCurrentFilters = oBinding.aFilters || [];
        
        // Forțează re-rendering prin eliminarea și readăugarea filtrelor
        oBinding.filter([], "Application");
        setTimeout(function() {
          oBinding.filter(aCurrentFilters, "Application");
        }.bind(this), 50);
      }
      
      this._applyFilters();
    },
 
    onRefresh: function (oEvent) {
      var oList = this.byId("fbList");
      var oBinding = oList && oList.getBinding("items");
      if (oBinding) { 
        oBinding.refresh(true);
      }
      oEvent.getSource().hide();
    },
 
    onBack: function () {
      var oComponent = this.getOwnerComponent();
      var oUserModel = oComponent.getModel("loggedUser");
      var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
 
      if (oUserModel) {
        var userData = oUserModel.getData();
        var role = (userData.role || "").toLowerCase();
        
        if (role === "manager") {
          oRouter.navTo("ManagerDashboard");
        } else {
          oRouter.navTo("UserDashboard");
        }
      } else {
        oRouter.navTo("UserDashboard");
      }
    },
 
    /* ===== Formatters ===== */
    fmtUserName: function (sUserId) {
      if (!sUserId) { return ""; }
      
      if (!this._userById || Object.keys(this._userById).length === 0) {
        setTimeout(function() {
          var oList = this.byId("fbList");
          var oBinding = oList && oList.getBinding("items");
          if (oBinding) {
            oBinding.refresh(false);
          }
        }.bind(this), 500); 
      }
      
      return (this._userById && this._userById[sUserId]) || sUserId;
    },

    fmtFromUserName: function (sUserId, sIsAnonymous) {
      if (!sUserId) { return ""; }
      
      if (this._sMode === "sent") {
        return (this._userById && this._userById[this._sUserId]) || this._sUserId;
      }
      
      if (sIsAnonymous === 'X') {
        return "Anonymous";
      }
    
      if (!this._userById || Object.keys(this._userById).length === 0) {
        setTimeout(function() {
          var oList = this.byId("fbList");
          var oBinding = oList && oList.getBinding("items");
          if (oBinding) {
            oBinding.refresh(false);
          }
        }.bind(this), 500); 
      }
      
      return (this._userById && this._userById[sUserId]) || sUserId;
    },

    fmtAnonymousStatus: function (sIsAnonymous) {
      return sIsAnonymous === 'X' ? 'X' : '-';
    },

    fmtAnonymousVisibility: function (sIsAnonymous) {
      // Verifică explicit dacă suntem în modul SENT
      var currentMode = this._sMode;
      
      // Dacă nu este setat _sMode, verifică din UI
      if (!currentMode) {
        var oSelect = this.byId("modeSelect");
        if (oSelect) {
          currentMode = oSelect.getSelectedKey() === "sent" ? "sent" : "received";
          this._sMode = currentMode;
        }
      }
      
      // Returnează true doar pentru modul SENT
      return (currentMode === "sent");
    },
 
    fmtTypeName: function (sTypeId) {
      if (!sTypeId) { return ""; }
      return (this._typeById && this._typeById[sTypeId]) || sTypeId;
    },
 
    fmtProjName: function (sProjId) {
      if (!sProjId) { return ""; }
       
      if (sProjId === "999") {
        return "-";
      }
      return (this._projById && this._projById[sProjId]) || sProjId;
    },
 
    fmtDate: function (sDate) {
      if (!sDate) return "";

      var oDate = new Date(sDate);
      if (isNaN(oDate.getTime())) {
        return sDate; 
      }
 
      return oDate.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    },
 
    /* ===== Helpers ===== */
    _normalizePadding: function (sValue) {
      if (!sValue) { return ""; }
      var s = String(sValue).trim();
      if (/^\d+$/.test(s) && s.length < 3) {
        s = s.padStart(3, "0");
      }
      return s;
    },

    _resolveFromUserId: function () {
      var oComp = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser");

      if (oLogged) {
        var id = oLogged.getProperty("/userId") || "";
        if (id) { 
          try { localStorage.setItem("loggedUserId", id); } catch (e) {}
          return Promise.resolve(id); 
        }
      }

      try {
        var cached = localStorage.getItem("loggedUserId") || "";
        if (cached) { 
          return Promise.resolve(cached); 
        }
      } catch (e) {}

      var email = "";
      if (oLogged) {
        email = oLogged.getProperty("/email") || "";
      }
      try { if (!email) email = localStorage.getItem("loggedEmail") || ""; } catch (e) {}
      
      if (!email) { 
        return Promise.resolve(""); 
      }

      var sEmailUp = email.toUpperCase();
      var oModel = oComp.getModel("mainService");

      return new Promise(function (resolve) {
        oModel.read("/UserSet", {
          filters: [ new Filter("EMAIL", FilterOperator.EQ, sEmailUp) ],
          urlParameters: { "$select": "USER_ID,EMAIL" },
          success: function (oData) {
            var uid = (oData.results && oData.results[0] && oData.results[0].USER_ID) || "";
            if (uid) {
              if (oLogged) { 
                oLogged.setProperty("/userId", uid);
              }
              try { localStorage.setItem("loggedUserId", uid); } catch (e) {}
            }
            resolve(uid);
          },
          error: function (err) { 
            resolve(""); 
          }
        });
      });
    }
 
  });
});