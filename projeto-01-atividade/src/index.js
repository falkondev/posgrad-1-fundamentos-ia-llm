import { UserController } from './controller/UserController.js';
import { ProductController } from './controller/ProductController.js';
import { ModelController } from './controller/ModelTrainingController.js';
import { TFVisorController } from './controller/TFVisorController.js';
import { EventLogController } from './controller/EventLogController.js';
import { TFVisorView } from './view/TFVisorView.js';
import { UserService } from './service/UserService.js';
import { ProductService } from './service/ProductService.js';
import { UserView } from './view/UserView.js';
import { ProductView } from './view/ProductView.js';
import { ModelView } from './view/ModelTrainingView.js';
import { EventLogView } from './view/EventLogView.js';
import Events from './events/events.js';
import { WorkerController } from './controller/WorkerController.js';

// Create shared services
const userService = new UserService();
const productService = new ProductService();

// Create views
const userView = new UserView();
const productView = new ProductView();
const modelView = new ModelView();
const tfVisorView = new TFVisorView();
const eventLogView = new EventLogView();

const mlWorker = new Worker('/src/workers/modelTrainingWorker.js', { type: 'module' });

WorkerController.init({
    worker: mlWorker,
    events: Events
});

ModelController.init({
    modelView,
    userService,
    events: Events,
});

TFVisorController.init({
    tfVisorView,
    events: Events,
});

EventLogController.init({
    eventLogView,
    events: Events,
});

ProductController.init({
    productView,
    userService,
    productService,
    events: Events,
});

await UserController.init({
    userView,
    userService,
    productService,
    events: Events,
});
