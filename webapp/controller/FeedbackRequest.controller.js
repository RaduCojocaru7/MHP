// webapp/controller/FeedbackRequest.controller.js
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/m/MessageToast"
], function (Controller, UIComponent, MessageToast) {
  "use strict";

  return Controller.extend("fbtool.controller.FeedbackRequest", {
    onInit: function () {
      // Optional: verificări dacă modelele sunt încărcate
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("ManagerDashboard");
    },

    onSubmitFeedback: function () {
      const oView = this.getView();
      const sMember = oView.byId("teamMemberCombo").getSelectedKey();
      const sProject = oView.byId("projectSelect").getSelectedKey();
      const sMessage = oView.byId("feedbackMessage").getValue();

      if (!sMember || !sProject || !sMessage.trim()) {
        MessageToast.show("Please fill all fields.");
        return;
      }

      MessageToast.show("Feedback request sent successfully!");
      oView.byId("feedbackMessage").setValue("");
      UIComponent.getRouterFor(this).navTo("ManagerDashboard");
    }
  });
});
