import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import customersRouter from "./customers";
import invoicesRouter from "./invoices";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import backupRouter from "./backup";
import financialYearsRouter from "./financial-years";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(customersRouter);
router.use(invoicesRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(backupRouter);
router.use(financialYearsRouter);

export default router;
