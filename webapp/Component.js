sap.ui.define([
  "sap/ui/core/UIComponent",
  "fbtool/model/models",
  "sap/ui/model/odata/v2/ODataModel"
], (UIComponent, models, ODataModel) => {
  "use strict";

  return UIComponent.extend("fbtool.Component", {
    metadata: { manifest: "json", interfaces: ["sap.ui.core.IAsyncContentCreation"] },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      this.setModel(models.createDeviceModel(), "device");

      // Fallback: dacă modelul din manifest nu e creat, îl creăm aici
      var oDefault = this.getModel();
      var oNamed   = this.getModel("mainService");

      if (!oDefault || !oNamed) {
        var oOData = new ODataModel({
          serviceUrl: "/sap/opu/odata/sap/ZARC_FEEDBACK_TOOL_SRV/",
          defaultBindingMode: "TwoWay",
          useBatch: true
        });

        if (!oDefault)     { this.setModel(oOData); }                 // default
        if (!oNamed)       { this.setModel(oOData, "mainService"); }  // named
        // console.info("ODataModel fallback set (default + mainService)");
      }

      this.getRouter().initialize();
    }
  });
});
