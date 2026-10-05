import Order from '../models/Order.js';
import Food from '../models/Food.js';
import sendOrderConfirmationEmail from '../utils/sendEmail.js';

const allowedPaymentMethods = new Set(['COD', 'BANK', 'MOMO']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const addOrderItems = async (req, res) => {
  try {
    const { items, shippingAddress, phone, paymentMethod, totalAmount, note, email } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email nhận thông báo' });
    }

    if (!emailPattern.test(String(email).trim())) {
      return res.status(400).json({ message: 'Email nhan thong bao khong hop le' });
    }

    if (!String(shippingAddress || '').trim() || !String(phone || '').trim()) {
      return res.status(400).json({ message: 'Dia chi giao hang va so dien thoai la bat buoc' });
    }

    if (paymentMethod && !allowedPaymentMethods.has(paymentMethod)) {
      return res.status(400).json({ message: 'Phuong thuc thanh toan khong hop le' });
    }

    const foodIds = items.map((item) => item.food);
    const foods = await Food.find({ _id: { $in: foodIds } }).select('name price images stock isAvailable');
    const foodById = new Map(foods.map((food) => [food._id.toString(), food]));

    for (const item of items) {
      const food = foodById.get(item.food?.toString());
      if (!food || food.isAvailable === false) {
        return res.status(400).json({ message: `Món "${food?.name || 'ăn'}" hiện đang tạm ngưng phục vụ.` });
      }
      const qty = Number(item.quantity);
      if (typeof food.stock === 'number' && food.stock < qty) {
        return res.status(400).json({
          message: `Món "${food.name}" chỉ còn ${food.stock} phần trong kho (bạn đặt ${qty} phần).`,
        });
      }
    }

    const normalizedItems = items.map((item) => {
      const food = foodById.get(item.food?.toString());
      const quantity = Number(item.quantity);

      if (!food || !Number.isInteger(quantity) || quantity <= 0) {
        return null;
      }

      return {
        food: food._id,
        name: food.name,
        price: food.price,
        quantity,
        image: food.images?.[0],
      };
    });

    if (normalizedItems.some((item) => item === null)) {
      return res.status(400).json({ message: 'Dữ liệu món ăn không hợp lệ' });
    }

    const calculatedTotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    let discount = 0;
    if (req.user.tier === 'Kim Cương') discount = 0.1;
    else if (req.user.tier === 'Vàng') discount = 0.05;
    
    const expectedTotal = calculatedTotal * (1 - discount);
    const submittedTotal = Number(totalAmount);

    if (!Number.isFinite(submittedTotal) || Math.abs(submittedTotal - expectedTotal) > 1) {
      return res.status(400).json({ message: 'Order total is invalid' });
    }

    const recipientEmail = String(email).trim().toLowerCase();
    const order = new Order({
      user: req.user._id,
      items: normalizedItems,
      shippingAddress: String(shippingAddress).trim(),
      phone: String(phone).trim(),
      email: recipientEmail,
      paymentMethod: paymentMethod || 'COD',
      totalAmount: submittedTotal,
      note,
    });

    const createdOrder = await order.save();

    const io = req.app.get('io');
    if (io) {
      await createdOrder.populate('user', 'id name');
      io.emit('newOrder', createdOrder);
    }
    
    // The order remains successful even if the email provider is temporarily unavailable.
    const emailNotificationSent = await sendOrderConfirmationEmail(createdOrder, recipientEmail);

    // Cập nhật soldCount và trừ stock cho từng món ăn
    const stockAndSoldUpdates = normalizedItems.map((item) => ({
      updateOne: {
        filter: { _id: item.food },
        update: {
          $inc: { soldCount: item.quantity, stock: -item.quantity },
        },
      },
    }));
    if (stockAndSoldUpdates.length > 0) {
      await Food.bulkWrite(stockAndSoldUpdates).catch((err) =>
        console.error('stock/soldCount update failed:', err.message)
      );
    }

    res.status(201).json({
      ...createdOrder.toObject(),
      emailNotificationSent,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (order) {
      if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(401).json({ message: 'Not authorized to view this order' });
      }
      res.json(order);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel order (User)
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      if (order.user.toString() !== req.user._id.toString()) {
         return res.status(401).json({ message: 'Không có quyền thao tác trên đơn hàng này.' });
      }
      if (order.orderStatus !== 'pending') {
         return res.status(400).json({ message: 'Chỉ có thể hủy đơn hàng đang ở trạng thái chờ xác nhận.' });
      }
      if (order.paymentStatus === 'paid') {
         return res.status(400).json({
           message: 'Đơn hàng đã được thanh toán trực tuyến. Vui lòng liên hệ hotline FoodCare để được hỗ trợ hủy và hoàn tiền.',
         });
      }
      order.orderStatus = 'cancelled';
      const updatedOrder = await order.save();

      // Hoàn lại số lượng tồn kho và giảm soldCount
      if (Array.isArray(order.items) && order.items.length > 0) {
        const restoreUpdates = order.items.map((item) => ({
          updateOne: {
            filter: { _id: item.food },
            update: {
              $inc: { soldCount: -item.quantity, stock: item.quantity },
            },
          },
        }));
        await Food.bulkWrite(restoreUpdates).catch((err) =>
          console.error('Stock restore failed:', err.message)
        );
      }

      const io = req.app.get('io');
      if (io) io.emit('orderUpdated', updatedOrder);

      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
