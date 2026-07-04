import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto, FindAllUsersDto } from './users.dto.js';
import { usersService } from './users.service.js';
import { env } from '../../config/env.js';
import { recordAuditEvent, AuditCategory, AuditSeverity } from '../audit/audit.service.js';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = FindAllUsersDto.parse(req.query);
    const result = await usersService.findAll(query.page, query.limit, query.search);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues.map((i) => i.message).join('; ') });
      return;
    }
    req.log.error({ err: error }, 'getUsers failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid user ID' }); return; }
    const user = await usersService.findOne(id);
    res.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'getUser failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = CreateUserDto.parse(req.body);
    const user = await usersService.create(dto);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues.map((i) => i.message).join('; ') });
      return;
    }
    if (error instanceof Error && error.message === 'A user with this email already exists') {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'createUser failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid user ID' }); return; }
    const dto = UpdateUserDto.parse(req.body);
    const user = await usersService.update(id, dto);
    res.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues.map((i) => i.message).join('; ') });
      return;
    }
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'updateUser failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid user ID' }); return; }
    const dto = ResetPasswordDto.parse(req.body);
    const user = await usersService.resetPassword(id, dto.newPassword);
    await recordAuditEvent({
      category: AuditCategory.USER_MANAGEMENT,
      action:   'USER_PASSWORD_RESET',
      actor:    { userId: req.user?.id, email: req.user?.email },
      severity: AuditSeverity.WARN,
      details:  { targetUserId: id, targetEmail: user.email },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues.map((i) => i.message).join('; ') });
      return;
    }
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'resetPassword failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid user ID' }); return; }
    const requestingUserId = req.user!.id;
    const isSystemAdmin = req.user!.email === env.SEED_USER_EMAIL;

    if (isSystemAdmin) {
      await usersService.hardDelete(id, requestingUserId);
      res.json({ success: true, data: null });
    } else {
      const user = await usersService.remove(id, requestingUserId);
      res.json({ success: true, data: user });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      if (
        error.message === 'Cannot deactivate your own account' ||
        error.message === 'Cannot delete your own account'
      ) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
    }
    req.log.error({ err: error }, 'deleteUser failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
