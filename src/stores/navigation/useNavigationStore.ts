import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export interface NavigationState {
    // Dialog states
    isSymbolSearchOpen: boolean;
    isQuickOutlineOpen: boolean;
    
    // Actions
    openSymbolSearch: () => void;
    closeSymbolSearch: () => void;
    toggleSymbolSearch: () => void;
    
    openQuickOutline: () => void;
    closeQuickOutline: () => void;
    toggleQuickOutline: () => void;
    
    closeAll: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useNavigationStore = create<NavigationState>((set) => ({
    // State
    isSymbolSearchOpen: false,
    isQuickOutlineOpen: false,
    
    // Actions
    openSymbolSearch: () => set({ isSymbolSearchOpen: true, isQuickOutlineOpen: false }),
    closeSymbolSearch: () => set({ isSymbolSearchOpen: false }),
    toggleSymbolSearch: () => set(state => ({ 
        isSymbolSearchOpen: !state.isSymbolSearchOpen, 
        isQuickOutlineOpen: false 
    })),
    
    openQuickOutline: () => set({ isQuickOutlineOpen: true, isSymbolSearchOpen: false }),
    closeQuickOutline: () => set({ isQuickOutlineOpen: false }),
    toggleQuickOutline: () => set(state => ({ 
        isQuickOutlineOpen: !state.isQuickOutlineOpen, 
        isSymbolSearchOpen: false 
    })),
    
    closeAll: () => set({ isSymbolSearchOpen: false, isQuickOutlineOpen: false }),
}));

