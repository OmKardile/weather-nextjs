'use client';

import { create } from 'zustand';

/* ================================================================== */
/* Interface edit mode — transient (never persisted). When active,     */
/* ForecastSections grows drag handles + hide buttons, sections        */
/* jiggle, and Settings' "Customize cards" row flips to "Done".        */
/* A tiny standalone store so the SettingsSheet and both               */
/* ForecastSections instances (desktop column + mobile drawer) share   */
/* one flag without prop drilling.                                     */
/* ================================================================== */

interface EditModeState {
  editMode: boolean;
  setEditMode: (editMode: boolean) => void;
  toggleEditMode: () => void;
}

export const useEditMode = create<EditModeState>()((set) => ({
  editMode: false,
  setEditMode: (editMode) => set({ editMode }),
  toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),
}));
