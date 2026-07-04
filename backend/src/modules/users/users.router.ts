import { Router } from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
} from './users.controller.js';

export const usersRouter = Router();

usersRouter.get('/', getUsers);
usersRouter.get('/:id', getUser);
usersRouter.post('/', createUser);
usersRouter.put('/:id', updateUser);
usersRouter.post('/:id/reset-password', resetPassword);
usersRouter.delete('/:id', deleteUser);