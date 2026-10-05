import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';
import { checkFoodHealthConflict } from '../utils/nutritionCalculator';
import AllergyWarningModal from '../components/AllergyWarningModal';

const CartContext = createContext();

const getStoredCartItems = () => {
  try {
    return JSON.parse(localStorage.getItem('cartItems')) || [];
  } catch {
    localStorage.removeItem('cartItems');
    return [];
  }
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const foodId = action.payload._id || action.payload.food;
      const existingItem = state.cartItems.find(item => item.food === foodId);
      if (existingItem) {
        return {
          ...state,
          cartItems: state.cartItems.map(item =>
            item.food === foodId ? { ...item, quantity: item.quantity + 1 } : item
          ),
        };
      }
      return { ...state, cartItems: [...state.cartItems, { ...action.payload, food: foodId, quantity: 1 }] };
    }
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cartItems: state.cartItems.filter(item => item.food !== action.payload),
      };
    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        return { ...state, cartItems: state.cartItems.filter(item => item.food !== id) };
      }
      return {
        ...state,
        cartItems: state.cartItems.map(item =>
          item.food === id ? { ...item, quantity } : item
        ),
      };
    }
    case 'CLEAR_CART':
      return { ...state, cartItems: [] };
    case 'REORDER': {
      // Thay thế giỏ hàng bằng các item từ đơn hàng cũ
      const newItems = action.payload.map((item) => ({
        food: item.food?.toString?.() || item.food,
        name: item.name,
        price: item.price,
        images: item.image ? [item.image] : [],
        quantity: item.quantity,
        isAvailable: true,
      }));
      return { ...state, cartItems: newItems };
    }
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, {
    cartItems: getStoredCartItems(),
  });
  const [allergyModal, setAllergyModal] = useState({
    isOpen: false,
    food: null,
    warnings: [],
  });

  // Lưu giỏ hàng vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(state.cartItems));
  }, [state.cartItems]);

  // Xóa giỏ hàng khi user đăng xuất
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'CLEAR_CART' });
    }
  }, [user]);

  const addToCart = (item, bypassWarning = false) => {
    if (!item) return;

    if (item.isAvailable === false) {
      toast.error('Món ăn này hiện đang tạm hết, không thể thêm vào giỏ hàng!', {
        position: "top-right",
        autoClose: 2500,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
        theme: "light",
      });
      return;
    }

    // Kiểm tra cảnh báo dị ứng & bệnh lý của người dùng nếu chưa xác nhận bỏ qua
    if (!bypassWarning && user?.healthProfile) {
      const { hasConflict, warnings } = checkFoodHealthConflict(item, user.healthProfile);
      if (hasConflict) {
        setAllergyModal({
          isOpen: true,
          food: item,
          warnings,
        });
        return;
      }
    }

    dispatch({ type: 'ADD_TO_CART', payload: item });
    toast.success('Đã thêm vào giỏ hàng thành công!', {
      position: "top-right",
      autoClose: 1500,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: true,
      theme: "light",
    });
  };

  const handleConfirmAddWithWarning = () => {
    if (allergyModal.food) {
      addToCart(allergyModal.food, true);
    }
    setAllergyModal({ isOpen: false, food: null, warnings: [] });
  };

  const handleCloseAllergyModal = () => {
    setAllergyModal({ isOpen: false, food: null, warnings: [] });
  };

  const removeFromCart = (id) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: id });
  };

  const updateQuantity = (id, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  // Mua lại toàn bộ đơn hàng cũ (replace giỏ hàng hiện tại)
  const reorder = (orderItems) => {
    dispatch({ type: 'REORDER', payload: orderItems });
    toast.success(`Đã thêm ${orderItems.length} món vào giỏ hàng!`, {
      position: 'top-right',
      autoClose: 2000,
      hideProgressBar: true,
      theme: 'light',
    });
  };

  return (
    <CartContext.Provider value={{ cartItems: state.cartItems, addToCart, removeFromCart, updateQuantity, clearCart, reorder }}>
      {children}
      <AllergyWarningModal
        isOpen={allergyModal.isOpen}
        food={allergyModal.food}
        warnings={allergyModal.warnings}
        onClose={handleCloseAllergyModal}
        onConfirm={handleConfirmAddWithWarning}
      />
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);

