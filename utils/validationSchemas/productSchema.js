import Joi from "joi";
import { PRODUCT_STATUS } from "../../models/productModel.js";

export const createProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  stock: Joi.number().integer().min(0).default(0),
  status: Joi.string()
    .valid(...Object.values(PRODUCT_STATUS))
    .default(PRODUCT_STATUS.ACTIVE),
  image: Joi.string().uri().optional(),
});

export const updateProductSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  price: Joi.number().min(0).optional(),
  stock: Joi.number().integer().min(0).optional(),
  status: Joi.string()
    .valid(...Object.values(PRODUCT_STATUS))
    .optional(),
  image: Joi.string().uri().optional(),
}).min(1);

export const purchaseProductSchema = Joi.object({
  quantity: Joi.number().integer().min(1).default(1),
});
