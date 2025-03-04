/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2021, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import { getNodeListByName } from '../../../../browser/static/js/node_ajax';
import {getUtilityView} from '../../../../browser/static/js/utility_view';
import Notify from '../../../../static/js/helpers/Notifier';
import getApiInstance from 'sources/api_instance';
import {retrieveAncestorOfTypeServer} from 'sources/tree/tree_utils';
import RestoreSchema, {getRestoreSaveOptSchema, getRestoreQueryOptionSchema, getRestoreDisableOptionSchema, getRestoreMiscellaneousSchema, getRestoreTypeObjSchema, getRestoreSectionSchema} from './restore.ui';

define('tools.restore', [
  'sources/gettext', 'sources/url_for', 'pgadmin.browser',
  'tools/restore/static/js/menu_utils', 'sources/nodes/supported_database_node',
], function(
  gettext, url_for, pgBrowser, menuUtils, supportedNodes
) {

  // if module is already initialized, refer to that.
  if (pgBrowser.Restore) {
    return pgBrowser.Restore;
  }

  // Create an Object Restore of pgBrowser class
  pgBrowser.Restore = {
    init: function() {
      if (this.initialized)
        return;

      this.initialized = true;

      // Define the nodes on which the menus to be appear
      var menus = [{
        name: 'restore_object',
        module: this,
        applies: ['tools'],
        callback: 'restoreObjects',
        priority: 2,
        label: gettext('Restore...'),
        icon: 'fa fa-upload',
        below: true,
        enable: supportedNodes.enabled.bind(
          null, pgBrowser.tree, menuUtils.restoreSupportedNodes
        ),
        data: {
          data_disabled: gettext('Please select any schema or table from the browser tree to Restore data.'),
        },
      }];

      for (var idx = 0; idx < menuUtils.restoreSupportedNodes.length; idx++) {
        menus.push({
          name: 'restore_' + menuUtils.restoreSupportedNodes[idx],
          node: menuUtils.restoreSupportedNodes[idx],
          module: this,
          applies: ['context'],
          callback: 'restoreObjects',
          priority: 2,
          label: gettext('Restore...'),
          icon: 'fa fa-upload',
          enable: supportedNodes.enabled.bind(
            null, pgBrowser.tree, menuUtils.restoreSupportedNodes
          ),
        });
      }

      pgBrowser.add_menus(menus);
      return this;
    },
    getUISchema: function(treeItem) {
      let treeNodeInfo = pgBrowser.tree.getTreeNodeHierarchy(treeItem);
      const selectedNode = pgBrowser.tree.selected();
      let itemNodeData = pgBrowser.tree.findNodeByDomElement(selectedNode).getData();

      return new RestoreSchema(
        ()=>getRestoreSectionSchema({selectedNodeType: itemNodeData._type}),
        ()=>getRestoreTypeObjSchema({selectedNodeType: itemNodeData._type}),
        ()=>getRestoreSaveOptSchema({nodeInfo: treeNodeInfo}),
        ()=>getRestoreQueryOptionSchema({nodeInfo: treeNodeInfo}),
        ()=>getRestoreDisableOptionSchema({nodeInfo: treeNodeInfo}),
        ()=>getRestoreMiscellaneousSchema({nodeInfo: treeNodeInfo}),
        {
          role: ()=>getNodeListByName('role', treeNodeInfo, itemNodeData)
        },
        treeNodeInfo,
        pgBrowser
      );
    },
    saveCallBack: function(data, dialog) {
      if(data.errormsg) {
        Notify.alert(
          gettext('Utility not found'),
          gettext(data.errormsg)
        );
      } else {
        pgBrowser.Events.trigger('pgadmin-bgprocess:created', dialog);
      }
    },
    setExtraParameters: function(treeInfo, nodeData) {
      var extraData = {};
      extraData['database'] = treeInfo.database._label;

      if('schema' in treeInfo) {
        extraData['schemas'] = treeInfo.schema._label;
      }

      if('table' in treeInfo) {
        extraData['tables'] = [nodeData._label];
      }

      if('function' in treeInfo) {
        extraData['functions'] = [nodeData._label];
      }
      return extraData;
    },
    url_for_utility_exists: function(id){
      return url_for('restore.utility_exists', {
        'sid': id,
      });
    },
    restoreObjects: function(action, treeItem) {
      var that = this,
        tree = pgBrowser.tree,
        i = treeItem || tree.selected(),
        data = i ? tree.itemData(i) : undefined,
        treeNodeInfo = pgBrowser.tree.getTreeNodeHierarchy(treeItem);

      const serverInformation = retrieveAncestorOfTypeServer(pgBrowser, treeItem, gettext('Restore Error')),
        sid = serverInformation._type == 'database' ? serverInformation._pid : serverInformation._id,
        api = getApiInstance(),
        utility_exists_url = that.url_for_utility_exists(sid);

      return api({
        url: utility_exists_url,
        method: 'GET'
      }).then((res)=>{
        if (!res.data.success) {
          Notify.alert(
            gettext('Utility not found'),
            gettext(res.data.errormsg)
          );
          return;
        }
        pgBrowser.Node.registerUtilityPanel();
        var panel = pgBrowser.Node.addUtilityPanel(),
          j = panel.$container.find('.obj_properties').first();

        var schema = that.getUISchema(treeItem);
        panel.title(gettext(`Restore (${pgBrowser.Nodes[data._type].label}: ${data.label})`));
        panel.focus();

        let urlShortcut = 'restore.create_job',
          baseUrl =  url_for(urlShortcut, {
            'sid': sid,
          }),
          extraData = that.setExtraParameters(treeNodeInfo, data);

        var sqlHelpUrl = 'restore.html',
          helpUrl = url_for('help.static', {
            'filename': 'restore_dialog.html',
          });

        getUtilityView(
          schema, treeNodeInfo, 'select', 'dialog', j[0], panel, that.saveCallBack, extraData, 'Restore', baseUrl, sqlHelpUrl, helpUrl);

      }).catch(()=>{
        Notify.alert(
          gettext('Utility not found'),
          gettext('Failed to fetch Utility information')
        );
        return;
      });
    },
  };
  return pgBrowser.Restore;
});
