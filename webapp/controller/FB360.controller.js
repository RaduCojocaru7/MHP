sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function(Controller, MessageToast) {
  "use strict";

  return Controller.extend("fbtool.controller.FB360", {

    onInit: function () {
      // Type-ahead "contains" pe ComboBox-ul de user
      var oCB = this.byId("userCombo");
      if (oCB && oCB.setFilterFunction) {
        oCB.setFilterFunction(function (sTerm, oItem) {
          var s = (oItem.getText() || "").toLowerCase();
          return s.indexOf((sTerm || "").toLowerCase()) !== -1;
        });
      }
    },

    onSendFeedback: function () {
      // citim userul selectat
      var oCB = this.byId("userCombo");
      var sUserId = oCB ? oCB.getSelectedKey() : "";
      var sUserName = oCB && oCB.getSelectedItem() ? oCB.getSelectedItem().getText() : "";

      if (!sUserId) {
        MessageToast.show("Please select a user for 360 feedback.");
        return;
      }

      // aici ai:
      //  - sUserId = USER_ID (cheia internă)
      //  - sUserName = NAME (textul afișat)
      // trimite-le în requestul tău (după cum ai nevoie)
      MessageToast.show("Feedback sent for " + sUserName + " (USER_ID: " + sUserId + ")");
    },

    onExit: function () {
      // Navighează către dashboard-ul potrivit în funcție de rol
      var oComponent = this.getOwnerComponent();
      var oUserModel = oComponent.getModel("loggedUser");
      var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

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
