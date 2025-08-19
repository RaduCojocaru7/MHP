sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function(Controller, MessageToast, MessageBox, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("fbtool.controller.FB360", {

    onInit: function () {
      // User ComboBox - search by "contains"
      var oUserCB = this.byId("userCombo");
      if (oUserCB && oUserCB.setFilterFunction) {
        oUserCB.setFilterFunction(function (sTerm, oItem) {
          var s = (oItem.getText() || "").toLowerCase();
          return s.indexOf((sTerm || "").toLowerCase()) !== -1;
        });
      }
      if (oUserCB) {
        oUserCB.attachChange(this._onUserChange, this);
      }

      // Project ComboBox
      var oProjCB = this.byId("projectCombo");
      if (oProjCB && oProjCB.setFilterFunction) {
        oProjCB.setFilterFunction(function (sTerm, oItem) {
          var s = (oItem.getText() || "").toLowerCase();
          return s.indexOf((sTerm || "").toLowerCase()) !== -1;
        });
      }
      if (oProjCB) {
        oProjCB.attachChange(function (oEvent) {
          if (!oEvent.getParameter("selectedItem")) {
            oProjCB.setSelectedKey("");
          }
        });
        var oBinding = oProjCB.getBinding("items");
        if (oBinding) { oBinding.filter([]); }
        oProjCB.setSelectedKey("");
      }
    },

    _onUserChange: function () {
      var sUserId = this.byId("userCombo").getSelectedKey();
      var oProjCB = this.byId("projectCombo");
      if (!oProjCB) { return; }

      // reset project
      oProjCB.setSelectedKey("");

      // filter projects by user
      var oBinding = oProjCB.getBinding("items");
      if (oBinding) {
        if (sUserId) {
          oBinding.filter([ new Filter("USER_ID", FilterOperator.EQ, sUserId) ]);
        } else {
          oBinding.filter([]);
        }
      }
    },

    onSendFeedback: function () {
      var oModel  = this.getOwnerComponent().getModel("mainService"); // OData V2

      var sToUser = this.byId("userCombo").getSelectedKey();          // -> TO_USER_ID
      var sProjId = this.byId("projectCombo").getSelectedKey();       // -> PROJ_ID
      var sTypeUi = this.byId("typeCombo").getSelectedKey() || "";    // -> FB_TYPE_ID
      var sText   = this.byId("feedbackText").getValue();

      // Logged user = FROM_USER_ID
      var sFromUser = this._getLoggedUserId();

      if (!sFromUser || !sToUser || !sProjId || !sText) {
        MessageToast.show("Completează User, Project și Feedback.");
        return;
      }

      // mapping type
      var typeMap = { tech: "001", soft: "002", other: "003" };
      var sTypeId = typeMap[sTypeUi] || sTypeUi || "001";

      var oPayload = {
        FROM_USER_ID : sFromUser,
        TO_USER_ID   : sToUser,
        PROJ_ID      : sProjId,
        FB_TYPE_ID   : sTypeId,
        INPUT_TEXT   : sText,
        IS_ANONYMOUS : "" // sau "X" dacă pui checkbox
      };

      this.getView().setBusy(true);

      oModel.create("/FeedbackSet", oPayload, {
        success: function (oCreated) {
          this.getView().setBusy(false);
          MessageToast.show("Feedback trimis. ID: " + (oCreated.FB_ID || "-"));
          this.byId("feedbackText").setValue("");
          this.byId("projectCombo").setSelectedKey("");
        }.bind(this),
        error: function (oErr) {
          this.getView().setBusy(false);
          MessageBox.error("Eroare la trimitere (FeedbackSet create).");
          console.error(oErr);
        }.bind(this)
      });
    },

    _getLoggedUserId: function () {
      var oComp = this.getOwnerComponent();
      var oLogged = oComp.getModel("loggedUser") && oComp.getModel("loggedUser").getData();

      if (oLogged && oLogged.user_id) {
        return oLogged.user_id;
      }

      var aUsers = oComp.getModel("userData") && oComp.getModel("userData").getData();
      if (oLogged && oLogged.email && Array.isArray(aUsers)) {
        var u = aUsers.find(function (it) {
          return it.email && it.email.toLowerCase() === oLogged.email.toLowerCase();
        });
        return u ? u.user_id : "";
      }
      return "";
    },

    onExit: function () {
      var oComponent     = this.getOwnerComponent();
      var oUserModel     = oComponent.getModel("loggedUser");
      var oRouter        = sap.ui.core.UIComponent.getRouterFor(this);
      var oUserDataModel = oComponent.getModel("userData");

      if (oUserModel && oUserDataModel) {
        var loggedUserData = oUserModel.getData();
        var allUsers = oUserDataModel.getData();

        var currentUser = allUsers.find(function(user) {
          return user.email && loggedUserData.email &&
                 user.email.toLowerCase() === loggedUserData.email.toLowerCase();
        });

        if (currentUser && currentUser.role && currentUser.role.toLowerCase() === "manager") {
          oRouter.navTo("ManagerDashboard");
        } else {
          oRouter.navTo("UserDashboard");
        }
      } else {
        oRouter.navTo("Login");
      }
    }
  });
});
