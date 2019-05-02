
import React from 'react';
import ReactDOM from 'react-dom';
import { withRouter } from 'react-router-dom';

import WidgetViewPanel from '../components/WidgetViewPanel';
import WidgetEditPanel from '../components/WidgetEditPanel';

import Modal from '../components/Modal';

import * as Constants from '../api/Constants';
import * as Util from '../api/Util';
import './Dashboard.css';

import * as webApi from '../api/WebApi';
import axios from 'axios';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

class DashboardEditView extends React.Component {

  constructor(props) {
    super(props);
    
    this.state = {
      showWidgetEditPanel: false,
      showConfirmDeletionPanel: false,
      objectToDelete: {},
      isEditMode: false,
      isFullScreenView: false,
      autoRefreshTimerId: '',
      lastRefreshed: '',
      refreshInterval: 15,
      lastRefreshLabelTimerId: '',
      jdbcDataSourceOptions: [],
      fromDashboard: '',
      dashboardId: 0,
      name: '',
      style: {},
      widgetViewWidth: 1000
    }

    this.widgetViewPanel = React.createRef();
    this.widgetEditPanel = React.createRef();
  }

  componentDidMount() {
    const id = this.props.match.params.id;
    if (id === undefined) {
      // If the drill through is triggered from the full-dashboard page already, this component is remounted but not FullScreenView.
      const dashboardName = this.props.match.params.name;
      if (dashboardName !== undefined) {
        this.loadViewByDashboardName();
        return;
      }
    }
    const dashboardId = id !== undefined ? id : null;

    console.log('DashboardEditView - componentDidMount', dashboardId);

    const url = this.props.location.search;
    const params = new URLSearchParams(url);
    const fromDashboard = params.get('$fromDashboard');

    for(let pair of params.entries()) {
      console.log(pair[0]+ ', '+ pair[1]); 
    } 

    const widgetViewWidth = this.getPageWidth();
    this.setState({
      widgetViewWidth: widgetViewWidth,
      fromDashboard: fromDashboard
    }, () => {
      if (dashboardId === null) {
        this.setState({
          dashboardId: null
        });
      } else {
        axios.get(`/ws/dashboard/${dashboardId}`)
          .then(res => {
            const dashboard = res.data;
            this.setState({
              dashboardId: dashboard.id,
              name: dashboard.name,
              style: dashboard.style
            }, () => {
              this.refresh();
            });
          });
      }
    });

    const lastRefreshLabelTimerId = setInterval(() => {
      this.updateReadableLastRefreshed();
    }, 5000);
    this.setState({
      lastRefreshLabelTimerId: lastRefreshLabelTimerId
    })
  }

  componentWillUnmount() {
    const { 
      autoRefreshTimerId,
      lastRefreshLabelTimerId
    } = this.state;
    if (autoRefreshTimerId) {
      clearInterval(autoRefreshTimerId);
    }
    if (lastRefreshLabelTimerId) {
      clearInterval(lastRefreshLabelTimerId);
    }
  }

  loadViewByDashboardName = () => {
    const dashboardName = this.props.match.params.name;
    const url = this.props.location.search;
    const params = new URLSearchParams(url);

    const showControl = params.get('$showControl');
    const fromDashboard = params.get('$fromDashboard');

    const widgetViewWidth = this.getPageWidth();

    this.setState({
      isFullScreenView: true,
      name: dashboardName,
      widgetViewWidth: widgetViewWidth,
      fromDashboard: fromDashboard
    }, () => {
      axios.get(`/ws/dashboard/name/${dashboardName}`)
        .then(res => {
          const result = res.data;
          this.setState({
            dashboardId: result.id,
            name: result.name,
            style: result.style
          }, () => {
            this.refresh();
          });
        });
    });
  }

  handleInputChange = (event) => {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  getPageWidth = () => {
    const thisNode = ReactDOM.findDOMNode(this);
    return thisNode.clientWidth - 40;
  }

  toggleAutoRefresh = () => {
    const { autoRefreshTimerId } = this.state;
    if (autoRefreshTimerId) {
      clearInterval(autoRefreshTimerId);
      this.setState({
        autoRefreshTimerId: ''
      });
    } else {
      const { refreshInterval } = this.state;
      let interval = parseInt(refreshInterval, 10) || 15;
      interval = interval < 1 ? 1 : interval;
      const timerId = setInterval(() => {
        this.queryWidgets();
        this.updateLastRefreshed();
      }, interval * 1000);
      this.setState({
        autoRefreshTimerId: timerId
      });
    }
  }

  refresh = () => {
    this.refreshWidgetView();
    this.updateLastRefreshed();
  }

  refreshWidgetView = () => {
    const { 
      dashboardId,
      widgetViewWidth
    } = this.state;
    this.widgetViewPanel.current.fetchWidgets(dashboardId, widgetViewWidth, null);
  } 

  queryWidgets = () => {
    this.widgetViewPanel.current.queryCharts();
  }

  updateLastRefreshed = () => {
    const now = new Date();
    this.setState({
      lastRefreshed: now
    }, () => {
      this.updateReadableLastRefreshed();
    });
  }

  updateReadableLastRefreshed = () => {
    const { lastRefreshed } = this.state;
    if (lastRefreshed instanceof Date) {
      const readableLastRefreshed = Util.getReadableDiffTime(lastRefreshed, new Date());
      this.setState({
        readableLastRefreshed: readableLastRefreshed
      })
    }
  }

  save = () => {
    const {
      dashboardId,
      name,
      style
    } = this.state;

    const dashboard = {
      id: dashboardId, 
      name: name,
      style: style
    };

    axios.put('/ws/dashboard/', dashboard)
      .then(res => {
      });

    this.props.onDashboardSave(dashboardId);

    this.setState({
      isEditMode: false
    });
  }

  edit = () => {
    this.setState({
      isEditMode: true
    });
  }

  cancelEdit = () => {
    this.setState({
      isEditMode: false
    });
  }

  onSaveWidget = () => {
    this.setState({ 
      showWidgetEditPanel: false 
    });
    // FIXME: not need to refresh. Just add to state.widgets
    this.refreshWidgetView();
  }

  openWidgetEditPanel = (widgetId) => {
    this.widgetEditPanel.current.fetchWidget(widgetId);
    this.setState({
      showWidgetEditPanel: true
    });
  }

  applyFilters = (filterParams) => {
    this.widgetViewPanel.current.queryWidgets(filterParams);
    this.updateLastRefreshed();
  }

  fullScreen = () => {
    const { name } = this.state;
    const url = `/workspace/dashboard/full/${name}`;
    window.open(url, '_blank');
  }

  onStyleValueChange = (name, value) => {
    const style = {...this.state.style};
    style[[name]] = value;
    this.setState({
      style: style
    });
  }

  onWidgetContentClick = (widgetClickEvent) => {
    const {
      name,
      isFullScreenView
    } = this.state;

    const {
      type,
      data
    } = widgetClickEvent;

    if (type === 'tableTdClick') {
      const {
        dashboardId,
        columnName,
        columnValue
      } = data;

      if (isFullScreenView) {
        axios.get(`/ws/dashboard/${dashboardId}`)
          .then(res => {
            const dashboard = res.data;
            const nextDashboard = dashboard.name;
            const nextLink = `/workspace/dashboard/full/${nextDashboard}?$fromDashboard=${name}&${columnName}=${columnValue}`;
            this.props.history.push(nextLink);
            // The router doesn't rerender the component so force to refresh the dashboard.
            //this.loadViewByDashboardName();
          });
      } else {
        const nextLink = `/workspace/dashboard/${dashboardId}?$fromDashboard=${name}&${columnName}=${columnValue}`;
        this.props.history.push(nextLink);
      }
    }
  }

  goBackToFromDashboard = () => {
    this.props.history.goBack();
  }

  confirmDelete = () => {
    const { 
      objectToDelete = {},
    } = this.state;
    const dashboardId = objectToDelete.id;
    axios.delete(`/ws/dashboard/${dashboardId}`)
      .then(res => {
        this.props.onDashboardDelete(dashboardId);
        this.closeConfirmDeletionPanel();
      });
  }

  deleteDashboard = () => {
    const { 
      dashboardId,
      name
    } = this.state;
    const dashboard = {
      id: dashboardId,
      name: name
    }
    this.openConfirmDeletionPanel(dashboard);
  }

  openConfirmDeletionPanel = (dashboard) => {
    this.setState({
      objectToDelete: dashboard,
      showConfirmDeletionPanel: true
    });
  }

  closeConfirmDeletionPanel = () => {
    this.setState({
      objectToDelete: {},
      showConfirmDeletionPanel: false
    });
  }

  render() {
    const {
      autoRefreshTimerId,
      readableLastRefreshed,
      isEditMode,
      isFullScreenView,
      fromDashboard
    } = this.state;
    const autoRefreshStatus = autoRefreshTimerId === '' ? 'OFF' : 'ON';

    let editButtonPanel;
    let fullScreenButtonPanel = null;
    const controlButtons = (
      <React.Fragment>
        <div className="inline-block">
          <div className="inline-block mr-3">
            Last refreshed: {readableLastRefreshed}
          </div>
          { autoRefreshStatus === 'OFF' && (
            <input 
              type="text" 
              name="refreshInterval" 
              value={this.state.refreshInterval}
              onChange={this.handleInputChange}
              className="inline-block" 
              style={{width: '50px'}}
            />
          )}
        </div>
        <button className="button square-button mr-3" onClick={this.toggleAutoRefresh}>
          {
            autoRefreshStatus === 'ON' ? 
            (
              <FontAwesomeIcon icon="stop-circle" size="lg" fixedWidth />
            ) : 
            (
              <FontAwesomeIcon icon="play-circle" size="lg" fixedWidth />
            )
          }
        </button>
        <button className="button square-button mr-3" onClick={this.refresh}>
          <FontAwesomeIcon icon="redo-alt" size="lg" fixedWidth />
        </button>
        <button className="button mr-3" onClick={this.queryWidgets}>
          <FontAwesomeIcon icon="filter" size="lg" fixedWidth /> Apply Filters
        </button>
      </React.Fragment>
    );

    if (!isFullScreenView) {
      if (isEditMode) {
        editButtonPanel = (
          <React.Fragment>
            <button className="button mr-3" onClick={this.cancelEdit}>
               <FontAwesomeIcon icon="times" size="lg" fixedWidth />
            </button>
            <button className="button mr-3" onClick={this.save}>
              <FontAwesomeIcon icon="save" size="lg" fixedWidth />
            </button>
            <button className="button mr-3" onClick={this.deleteDashboard}>
               <FontAwesomeIcon icon="trash-alt" size="lg" fixedWidth />
            </button>
            <button className="button" onClick={() => this.openWidgetEditPanel(null)}>
              <FontAwesomeIcon icon="calendar-plus" size="lg" fixedWidth /> New Widget
            </button>
          </React.Fragment>
        );
      } else {
        editButtonPanel = (
          <React.Fragment>
            {controlButtons}
            <button className="button square-button mr-3" onClick={this.fullScreen}>
              <FontAwesomeIcon icon="tv" size="lg" fixedWidth />
            </button>
            <button className="button" onClick={this.edit}>
              <FontAwesomeIcon icon="edit" size="lg" fixedWidth />
            </button>
          </React.Fragment>
        );
      }
    } else {
      fullScreenButtonPanel = controlButtons;
    }

    return (
      <React.Fragment>
        <div className="dashboard-menu-panel row">
          <div className="float-left">
            {fromDashboard && (
              <div className="dashboard-drillthrough-name" onClick={this.goBackToFromDashboard}>
                <span className="link-label">{fromDashboard}</span> >
              </div>
            )}
          </div>
          <div className="float-left">
            {
              isFullScreenView || !isEditMode ?
              (
                <div className="dashboard-name">
                  {this.state.name}
                </div>
              ) :(
                <input 
                  type="text" 
                  name="name" 
                  value={this.state.name}
                  onChange={this.handleInputChange} 
                  className="dashboard-name-input"
                />
              )
            }
            
          </div>
          <div className="float-right">
            {fullScreenButtonPanel}
            {editButtonPanel}
          </div>
        </div>

        <WidgetViewPanel 
          ref={this.widgetViewPanel} 
          isEditMode={this.state.isEditMode}
          widgetViewWidth={this.state.widgetViewWidth}
          onWidgetEdit={this.openWidgetEditPanel}
          onStyleValueChange={this.onStyleValueChange}
          onWidgetContentClick={this.onWidgetContentClick}
          {...this.state.style}
        />

        <Modal 
          show={this.state.showWidgetEditPanel}
          onClose={() => this.setState({ showWidgetEditPanel: false })}
          modalClass={'dashboard-edit-widget-dialog'} 
          title={'Widget Edit'} >
          <WidgetEditPanel 
            ref={this.widgetEditPanel} 
            jdbcDataSourceOptions={this.state.jdbcDataSourceOptions}
            dashboardId={this.state.dashboardId}
            onSave={this.onSaveWidget}
          />
        </Modal>

        <Modal 
          show={this.state.showConfirmDeletionPanel}
          onClose={this.closeConfirmDeletionPanel}
          modalClass={'small-modal-panel'}
          title={'Confirm Deletion'} >
          <div className="confirm-deletion-panel">
            Are you sure you want to delete {this.state.objectToDelete.name}?
          </div>
          <button className="button" onClick={this.confirmDelete}>Delete</button>
        </Modal>

      </React.Fragment>
    )
  };
}

export default withRouter(DashboardEditView);
