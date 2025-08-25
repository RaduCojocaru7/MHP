sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator", 
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/core/BusyIndicator"
], function (Controller, Filter, FilterOperator, MessageToast, MessageBox, BusyIndicator) {
  "use strict";

  return Controller.extend("fbtool.controller.ForgotPassword", {
    
    onInit: function () {
      this.clearInputs();
      this._addEnterKeyListener();
    },

    _addEnterKeyListener: function() {
      var oEmailInput = this.byId("forgotEmailInput");
      
      if (oEmailInput) {
        oEmailInput.attachBrowserEvent("keypress", function(oEvent) {
          if (oEvent.which === 13) { 
            this.onRequestPassword();
          }
        }.bind(this));
      }
    },

    clearInputs: function () {
      try {
        this.byId("forgotEmailInput")?.setValue("");
      } catch (e) {}
    },

    onRequestPassword: function () {
      var sEmail = (this.byId("forgotEmailInput").getValue() || "").trim();

      if (!sEmail) {
        MessageToast.show("Please enter your email address.");
        return;
      }

      if (!this._isValidEmail(sEmail)) {
        MessageToast.show("Please enter a valid email address.");
        return;
      }

      var sEmailUpper = sEmail.toUpperCase();

      var oModel = this.getOwnerComponent().getModel() ||
                   this.getOwnerComponent().getModel("mainService");

      if (!oModel) {
        MessageToast.show("OData model not available.");
        console.error("No OData model (default or 'mainService'). Check manifest & ui5-local.yaml proxy.");
        return;
      }

      BusyIndicator.show(0);

      var aFilters = [
        new Filter("EMAIL", FilterOperator.EQ, sEmailUpper)
      ];

      oModel.read("/UserSet", {
        filters: aFilters,
        urlParameters: { "$top": 1 },
        success: function (oData) {
          var aRes = oData && oData.results ? oData.results : [];
          if (!aRes.length) {
            BusyIndicator.hide();
            MessageToast.show("No account found with this email address.");
            return;
          }

          var oUser = aRes[0];
          var sUserId = oUser.USER_ID;
          this._sendPasswordReset(sUserId, sEmailUpper);
          
        }.bind(this),
        error: function (oErr) {
          BusyIndicator.hide();
          console.error("OData read error:", oErr);
          MessageToast.show("Error checking email. Please try again.");
        }.bind(this)
      });
    },

    _sendPasswordReset: function(sUserId, sEmail) {
      var oModel = this.getOwnerComponent().getModel() ||
                   this.getOwnerComponent().getModel("mainService");

      // Payload pentru UPDATE cu token-ul special pentru reset
      var oPayload = {
        USER_ID: sUserId,
        EMAIL: sEmail,
        PASSWORD: "!RESET!"
      };

      oModel.update("/UserSet('" + sUserId + "')", oPayload, {
        success: function (oData, oResponse) {
          BusyIndicator.hide();
          
          MessageBox.success("Password reset instructions have been sent to your email address.", {
            title: "Reset Request Sent",
            onClose: function () {
              this.onBackToLogin();
            }.bind(this)
          });
        }.bind(this),
        error: function (oError) {
          BusyIndicator.hide();
          
          var sErrorMessage = "Failed to send reset instructions. Please try again.";

          try {
            if (oError.responseText) {
              var oErrorResponse = JSON.parse(oError.responseText);
              if (oErrorResponse.error && oErrorResponse.error.message) {
                sErrorMessage = oErrorResponse.error.message.value || sErrorMessage;
              }
            }
          } catch (e) {
            console.error("Error parsing error response:", e);
          }
          
          console.error("OData update error:", oError);
          MessageBox.error(sErrorMessage, {
            title: "Reset Failed"
          });
        }.bind(this)
      });
    },

    _isValidEmail: function (sEmail) {
      var oRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return oRegex.test(sEmail);
    },

    onBackToLogin: function () {
      var oRouter = this.getOwnerComponent().getRouter();
      if (oRouter) {
        this.clearInputs();
        oRouter.navTo("Login");
      }
    }
  });
});