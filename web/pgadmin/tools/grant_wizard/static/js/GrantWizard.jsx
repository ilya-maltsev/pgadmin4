/////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2021, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////

import gettext from 'sources/gettext';
import _ from 'lodash';
import url_for from 'sources/url_for';
import React from 'react';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Wizard from '../../../../static/js/helpers/wizard/Wizard';
import WizardStep from '../../../../static/js/helpers/wizard/WizardStep';
import PgTable from 'sources/components/PgTable';
import { getNodePrivilegeRoleSchema } from '../../../../../pgadmin/browser/server_groups/servers/static/js/privilege.ui.js';
import { InputSQL, InputText, FormFooterMessage, MESSAGE_TYPE } from '../../../../static/js/components/FormComponents';
import getApiInstance from '../../../../static/js/api_instance';
import SchemaView from '../../../../static/js/SchemaView';
import clsx from 'clsx';
import Alertify from 'pgadmin.alertifyjs';
import PropTypes from 'prop-types';
import PrivilegeSchema from './privilege_schema.ui';
import Notify from '../../../../static/js/helpers/Notifier';

const useStyles = makeStyles(() =>
  ({
    root: {
      height: '100%'
    },
    searchBox: {
      marginBottom: '1em',
      display: 'flex',
    },
    searchPadding: {
      flex: 2.5
    },
    searchInput: {
      flex: 1,
      marginTop: 2,
      borderLeft: 'none',
      paddingLeft: 5
    },
    grantWizardSql: {
      height: '90% !important',
      width: '100%'
    },
    privilegeStep: {
      height: '100%',
      overflow: 'auto'
    },
    panelContent: {
      flexGrow: 1,
      minHeight: 0
    }
  }),
);

export default function GrantWizard({ sid, did, nodeInfo, nodeData }) {
  const classes = useStyles();
  var columns = [
    {

      Header: 'Object Type',
      accessor: 'object_type',
      sortble: true,
      resizable: false,
      disableGlobalFilter: true
    },
    {
      Header: 'Schema',
      accessor: 'nspname',
      sortble: true,
      resizable: false,
      disableGlobalFilter: true
    },
    {
      Header: 'Name',
      accessor: 'name_with_args',
      sortble: true,
      resizable: true,
      disableGlobalFilter: false,
      minWidth: 280
    },
    {
      Header: 'parameters',
      accessor: 'proargs',
      sortble: false,
      resizable: false,
      disableGlobalFilter: false,
      minWidth: 280,
      isVisible: false
    },
    {
      Header: 'Name',
      accessor: 'name',
      sortble: false,
      resizable: false,
      disableGlobalFilter: false,
      minWidth: 280,
      isVisible: false
    },
    {
      Header: 'ID',
      accessor: 'oid',
      sortble: false,
      resizable: false,
      disableGlobalFilter: false,
      minWidth: 280,
      isVisible: false
    }
  ];
  var steps = ['Object Selection', 'Privilege Selection', 'Review'];
  const [selectedObject, setSelectedObject] = React.useState([]);
  const [selectedAcl, setSelectedAcl] = React.useState({});
  const [msqlData, setSQL] = React.useState('');
  const [searchVal, setSearchVal] = React.useState('');
  const [loaderText, setLoaderText] = React.useState('');
  const [tablebData, setTableData] = React.useState([]);
  const [privOptions, setPrivOptions] = React.useState({});
  const [privileges, setPrivileges] = React.useState([]);
  const [privSchemaInstance, setPrivSchemaInstance] = React.useState();
  const [errMsg, setErrMsg] = React.useState('');

  const api = getApiInstance();
  const validatePrivilege = () => {
    var isValid = true;
    selectedAcl.privilege.forEach((priv) => {
      if ((_.isUndefined(priv.grantee) || _.isUndefined(priv.privileges) || priv.privileges.length === 0) && isValid) {
        isValid = false;
      }
    });
    return !isValid;
  };


  React.useEffect(() => {
    privSchemaInstance?.privilegeRoleSchema.updateSupportedPrivs(privileges);
  }, [privileges]);

  React.useEffect(() => {
    const privSchema = new PrivilegeSchema((privileges) => getNodePrivilegeRoleSchema('', nodeInfo, nodeData, privileges));
    setPrivSchemaInstance(privSchema);
    setLoaderText('Loading...');

    api.get(url_for(
      'grant_wizard.acl', {
        'sid': encodeURI(sid),
        'did': encodeURI(did),
      }
    )).then(res => {
      setPrivOptions(res.data);
    });

    var node_type = nodeData._type.replace('coll-', '').replace(
      'materialized_', ''
    );
    var _url = url_for(
      'grant_wizard.objects', {
        'sid': encodeURI(sid),
        'did': encodeURI(did),
        'node_id': encodeURI(nodeData._id),
        'node_type': encodeURI(node_type),
      });
    api.get(_url)
      .then(res => {
        var data = res.data.result;
        data.forEach(element => {
          if (element.icon)
            element['icon'] = {
              'object_type': element.icon
            };
          if(element.object_type === 'Function') {
            element.name_with_args = element.name + '(' + (typeof(element.proargs) != 'undefined' ? element.proargs : '') + ')';
          } else {
            element.name_with_args = element.name;
          }
        });
        setTableData(data);
        setLoaderText('');
      })
      .catch(() => {
        Notify.error(gettext('Error while fetching grant wizard data.'));
        setLoaderText('');
      });
  }, [nodeData]);

  const wizardStepChange = (data) => {
    switch (data.currentStep) {
    case 2:
      setLoaderText('Loading SQL ...');
      var msql_url = url_for(
        'grant_wizard.modified_sql', {
          'sid': encodeURI(sid),
          'did': encodeURI(did),
        });
      var post_data = {
        acl: selectedAcl.privilege,
        objects: selectedObject
      };
      api.post(msql_url, post_data)
        .then(res => {
          setSQL(res.data.data);
          setLoaderText('');
        })
        .catch(() => {
          Notify.error(gettext('Error while fetching SQL.'));
        });
      break;
    default:
      break;
    }
  };

  const onSave = () => {
    setLoaderText('Saving...');
    var _url = url_for(
      'grant_wizard.apply', {
        'sid': encodeURI(sid),
        'did': encodeURI(did),
      });
    const post_data = {
      acl: selectedAcl.privilege,
      objects: selectedObject
    };
    api.post(_url, post_data)
      .then(() => {
        setLoaderText('');
        Alertify.grantWizardDialog().close();
      })
      .catch((error) => {
        setLoaderText('');
        Notify.error(gettext(`Error while saving grant wizard data: ${error.response.data.errormsg}`));
      });
  };

  const disableNextCheck = (stepId) => {
    return selectedObject.length > 0 && stepId === 0 ?
      false : selectedAcl?.privilege?.length > 0 && stepId === 1 ? validatePrivilege() : true;
  };

  const onDialogHelp= () => {
    window.open(url_for('help.static', { 'filename': 'grant_wizard.html' }), 'pgadmin_help');
  };

  const getTableSelectedRows = (selRows) => {
    var selObj = [];
    var objectTypes = new Set();
    if (selRows.length > 0) {

      selRows.forEach((row) => {
        var object_type = '';
        switch (row.values.object_type) {
        case 'Function':
          object_type = 'function';
          break;
        case 'Trigger Function':
          object_type = 'function';
          break;
        case 'Procedure':
          object_type = 'procedure';
          break;
        case 'Table':
          object_type = 'table';
          break;
        case 'Sequence':
          object_type = 'sequence';
          break;
        case 'View':
          object_type = 'table';
          break;
        case 'Materialized View':
          object_type = 'table';
          break;
        case 'Foreign Table':
          object_type = 'foreign_table';
          break;
        case 'Package':
          object_type = 'package';
          break;
        default:
          break;
        }

        objectTypes.add(object_type);
        selObj.push(row.values);
      });
    }
    var privileges = new Set();
    objectTypes.forEach((objType) => {
      privOptions[objType]?.acl.forEach((priv) => {
        privileges.add(priv);
      });
    });
    setPrivileges(Array.from(privileges));
    setSelectedObject(selObj);
    setErrMsg(selObj.length === 0 ? gettext('Please select any database object.') : '');
  };

  const onErrClose = React.useCallback(()=>{
    setErrMsg('');
  });

  return (
    <Wizard
      title={gettext('Grant Wizard')}
      stepList={steps}
      disableNextStep={disableNextCheck}
      onStepChange={wizardStepChange}
      onSave={onSave}
      onHelp={onDialogHelp}
      loaderText={loaderText}
    >
      <WizardStep stepId={0}>
        <Box className={classes.searchBox}>
          <Box className={classes.searchPadding}></Box>
          <InputText
            placeholder={'Search'}
            className={classes.searchInput}
            value={searchVal}
            onChange={(val) => {
              setSearchVal(val);}
            }>
          </InputText>
        </Box>
        <Box className={classes.panelContent}>
          <PgTable
            className={classes.table}
            height={window.innerHeight - 450}
            columns={columns}
            data={tablebData}
            isSelectRow={true}
            searchText={searchVal}
            getSelectedRows={getTableSelectedRows}>
          </PgTable>
        </Box>
        <FormFooterMessage type={MESSAGE_TYPE.ERROR} message={errMsg} onClose={onErrClose} />
      </WizardStep>
      <WizardStep
        stepId={1}
        className={clsx(classes.privilegeStep)}>
        {privSchemaInstance &&
                  <SchemaView
                    formType={'dialog'}
                    getInitData={() => { }}
                    viewHelperProps={{ mode: 'create' }}
                    schema={privSchemaInstance}
                    showFooter={false}
                    isTabView={false}
                    onDataChange={(isChanged, changedData) => {
                      setSelectedAcl(changedData);
                    }}
                  />
        }
      </WizardStep>
      <WizardStep
        stepId={2}>
        <Box>{gettext('The SQL below will be executed on the database server to grant the selected privileges. Please click on Finish to complete the process.')}</Box>
        <InputSQL
          onLable={true}
          className={classes.grantWizardSql}
          readonly={true}
          value={msqlData.toString()} />
      </WizardStep>
    </Wizard>
  );
}

GrantWizard.propTypes = {
  sid: PropTypes.string,
  did: PropTypes.number,
  nodeInfo: PropTypes.object,
  nodeData: PropTypes.object,
};


