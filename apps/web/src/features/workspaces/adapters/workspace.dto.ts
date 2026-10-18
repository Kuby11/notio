import { z } from 'zod';
import {
  WorkspaceSchema,
  WorkspaceListItemSchema,
  MemberSchema,
  InvitationSchema,
} from '@notio/contracts';

export const WorkspaceResponseSchema = WorkspaceSchema;
export const WorkspaceListResponseSchema = z.object({ items: z.array(WorkspaceListItemSchema) });
export const MemberResponseSchema = MemberSchema;
export const MemberListResponseSchema = z.object({ items: z.array(MemberSchema) });
export const InvitationResponseSchema = InvitationSchema;
export const InvitationListResponseSchema = z.object({ items: z.array(InvitationSchema) });
