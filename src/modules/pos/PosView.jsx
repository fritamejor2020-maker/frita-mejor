import React, { useState, useEffect, useRef } from 'react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore }      from '../../store/useAuthStore';
import { Button }            from '../../components/ui/Button';
import { generateReceiptHTML } from './PosReceipt';
import { generateZReportHTML }   from './ZReportReceipt';
import { IncomesModal }          from './components/IncomesModal';
import { ExpensesModal }         from './components/ExpensesModal';
import { formatMoney }           from '../../utils/formatUtils';

export function PosView() {
  const [showMobileTicket, setShowMobileTicket] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showClientAccountModal, setShowClientAccountModal] = useState(false);
  const [showContratasPanel, setShowContratasPanel] = useState(false);
  const { user, signOut } = useAuthStore();
  const { 
    inventory = [], 
    posCategories = [], 
    customers = [], 
    posSettings,
    posSales = [], 
    posShifts = [], 
    posExpenses = [], 
    customerTypes = [],
    addCustomer,
    addContrataPayment,
    getContrataBalance,
    contrataPayments = [],
    addPosSale, updatePosSale, addPosShift, updatePosShift, addPosExpense 
  } = useInventoryStore();

  // Shift logic (find active shift)
  const activeShift = (posShifts || []).find(s => !s.closedAt);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomesModal, setShowIncomesModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [pinPromptConfig, setPinPromptConfig] = useState(null); // { message, expectedPin, onSuccess }

  // Navigation states
  const [currentFolder, setCurrentFolder] = useState(null); // null = root
  const searchInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Ticket states
  const [ticketItems, setTicketItems]     = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [activeSuspendedId, setActiveSuspendedId] = useState(null);

  // Modal & Print states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showLogoutPromptModal, setShowLogoutPromptModal] = useState(false);
  const [lastSale, setLastSale] = useState(null); // Used for printing the receipt
  const [lastClosedShift, setLastClosedShift] = useState(null); // Used for printing Z Report

  const [variablePriceProduct, setVariablePriceProduct] = useState(null);
  const [variablePriceInput, setVariablePriceInput] = useState('');

  // Auto-open shift modal if none is active when component mounts
  useEffect(() => {
    if (!activeShift) {
      setShowShiftModal(true);
    }
  }, [activeShift]);
  
  // Enforce customer selection via a mock hook that sets the default
  useEffect(() => {
    if (!selectedCustomer && customers?.length > 0) {
      setSelectedCustomer(customers[0].id);
    }
  }, [customers, selectedCustomer]);

  // Keep focus on the search barcode input unless user interacts with something else
  useEffect(() => {
    const focusInput = () => {
      const activeTag = document.activeElement.tagName;
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('click', focusInput);
    return () => document.removeEventListener('click', focusInput);
  }, []);

  // -- CALCULATIONS --
  const customer = customers?.find(c => c.id === selectedCustomer);
  const discountPercent = customer?.discountPercent || 0;
  
  const subtotal = ticketItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const discountAmount = subtotal * (discountPercent/100);
  const total = subtotal - discountAmount;

  // -- PRINT HELPER --
  // Uses a hidden iframe to print the HTML string without locking the main POS
  // and avoiding popup blockers or React crashes caused by window.open & document.write.
  const printHTML = (htmlContent, title = 'Imprimir') => {
    if (!htmlContent) return;

    // Create an invisible iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);
    doc.close();

    // Give it a moment to load styles, then print and remove iframe
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      
      // Remove iframe after printing dialogue is closed (or immediately after it opens)
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  // -- SHIFT ACTIONS --
  const handleOpenShift = (initialAmount) => {
    addPosShift({
      openedAt: new Date().toISOString(),
      closedAt: null,
      initialAmount: parseFloat(initialAmount) || 0,
      userId: user?.id,
      userName: user?.name,
    });
    setShowShiftModal(false);
  };

  const handleCloseShift = (realCount) => {
    if (!activeShift) return;
    const closedDate = new Date().toISOString();
    const closedShiftData = { ...activeShift, closedAt: closedDate, realAmount: parseFloat(realCount) || 0 };
    updatePosShift(activeShift.id, {
      closedAt: closedDate,
      realAmount: parseFloat(realCount) || 0,
    });
    setLastClosedShift(closedShiftData);
    setShowClosingModal(false);
    
    // Auto print Z report & Open Drawer without asking
    const code = posSettings?.cashDrawerCode || '\\x1B\\x70\\x00\\x19\\xFA';
    console.log(`--- ENVIANDO COMANDO DE APERTURA DE CAJÓN: ${code} ---`);
    
    const shiftSales = (posSales || []).filter(s => s.shiftId === activeShift.id && s.status === 'PAID');
    const shiftExpenses = (posExpenses || []).filter(e => e.shiftId === activeShift.id);
    
    const zReportHtml = generateZReportHTML(closedShiftData, shiftSales, shiftExpenses);
    setTimeout(() => printHTML(zReportHtml, 'Reporte Z'), 200);

    // Show prompt for logout
    setTimeout(() => {
        setShowLogoutPromptModal(true);
    }, 500);
  };

  const handleAddExpense = (amount, reason) => {
    addPosExpense({
      shiftId: activeShift?.id || null,
      amount: parseFloat(amount),
      reason,
      timestamp: new Date().toISOString(),
      userId: user?.id,
      userName: user?.name
    });
    setShowExpenseModal(false);
  };

  // -- ACTIONS --
  const handleItemAdd = (item, overridePrice = null) => {
    if (!activeShift) {
      alert("Debes abrir turno (caja) antes de vender.");
      setShowShiftModal(true);
      return;
    }

    // Si el producto es de precio variable (flag explícito) o precio 0, abrimos modal
    if (overridePrice === null && (item.variablePrice === true || !item.price || item.price <= 0)) {
       setVariablePriceProduct(item);
       return;
    }

    // Check for custom VIP price based on Customer Type
    let finalPrice = overridePrice !== null ? overridePrice : item.price;
    let isCustomPrice = overridePrice !== null;
    
    if (overridePrice === null && customer && customer.typeId) {
      const cType = customerTypes.find(t => t.id === customer.typeId);
      if (cType && cType.productDiscounts && cType.productDiscounts.length > 0) {
        const discountRule = cType.productDiscounts.find(d => d.productId === item.id);
        if (discountRule && discountRule.discountValue !== undefined) {
          finalPrice = discountRule.discountValue;
          isCustomPrice = true;
        }
      }
    }

    setTicketItems(prev => {
      const ticketItemId = overridePrice !== null ? `${item.id}-var-${overridePrice}` : item.id;
      const existing = prev.find(i => i.id === ticketItemId);
      if (existing) {
        return prev.map(i => i.id === ticketItemId ? { ...i, qty: i.qty + 1, price: finalPrice, isCustomPrice } : i);
      }
      return [{ ...item, realId: item.id, id: ticketItemId, qty: 1, price: finalPrice, originalPrice: item.price, isCustomPrice }, ...prev];
    });
    setSearchTerm(''); // Clear scanner
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleQtyChange = (id, delta) => {
    setTicketItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(0, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }).filter(i => i.qty > 0)); // Remove items with 0 qty
  };

  const handleBarcodeSearch = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      // Find matching item by barcode or name
      const found = inventory.find(i => (i.barcode === term) || i.name.toLowerCase().includes(term));
      if (found) {
        handleItemAdd(found);
      } else {
        alert('Producto no encontrado');
      }
      setSearchTerm('');
    }
  };

  const handleSaveSale = () => {
    if (ticketItems.length === 0) return;
    const saleData = {
      customerId: selectedCustomer,
      items: ticketItems,
      subtotal,
      discountPercent,
      discountAmount,
      total,
      status: 'SUSPENDED',
      timestamp: new Date().toISOString()
    };
    if (activeSuspendedId) {
      updatePosSale(activeSuspendedId, saleData);
    } else {
      addPosSale(saleData);
    }
    // Clear ticket
    setTicketItems([]);
    setActiveSuspendedId(null);
  };

  const handlePrintOrder = () => {
    if (ticketItems.length === 0) return;
    const c = customers?.find(c => c.id === selectedCustomer);
    const typeName = c?.typeId ? (customerTypes.find(t => t.id === c.typeId)?.name || '') : '';
    const orderHtml = `
      <div style="width:80mm;color:black;font-family:sans-serif;font-size:14px;padding:16px;margin:0 auto;">
        <style>@page{size:auto;margin:0;}@media print{body{margin:0;}}</style>
        <div style="text-align:center;margin-bottom:12px;border-bottom:2px dashed black;padding-bottom:8px;">
          <h1 style="font-weight:900;font-size:20px;margin:0;">📋 PEDIDO</h1>
          <p style="font-size:12px;margin:4px 0 0;">${new Date().toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'})}</p>
        </div>
        ${c ? `<div style="background:#f3f4f6;padding:8px;border-radius:8px;margin-bottom:12px;">
          <p style="font-weight:900;margin:0;font-size:14px;">${c.name}</p>
          ${typeName ? `<p style="margin:2px 0 0;font-size:12px;color:#666;">${typeName}</p>` : ''}
          ${c.phone ? `<p style="margin:2px 0 0;font-size:12px;">Tel: ${c.phone}</p>` : ''}
        </div>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:2px solid black;"><th style="text-align:left;padding:4px 0;">Producto</th><th style="text-align:center;width:40px;">Cant</th><th style="text-align:right;padding:4px 0;">Total</th></tr></thead>
          <tbody>
            ${ticketItems.map(i => `<tr style="border-bottom:1px dashed #ccc;"><td style="padding:4px 0;">${i.name}</td><td style="text-align:center;">${i.qty}</td><td style="text-align:right;font-weight:bold;">$${(i.price * i.qty).toLocaleString('es-CO')}</td></tr>`).join('')}
          </tbody>
        </table>
        <div style="border-top:2px solid black;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:900;font-size:18px;">
          <span>TOTAL</span><span>$${total.toLocaleString('es-CO')}</span>
        </div>
        <p style="text-align:center;margin-top:16px;font-size:12px;font-weight:bold;color:#666;">⏳ PENDIENTE DE PAGO</p>
      </div>
    `;
    printHTML(orderHtml, 'Pedido');
    // Also save as suspended
    handleSaveSale();
  };

  const handleLoadSuspended = (sale) => {
    setTicketItems(sale.items);
    setSelectedCustomer(sale.customerId);
    setActiveSuspendedId(sale.id);
    setShowSuspendedModal(false);
  };

  const handleProcessPayment = (methodName, amountProvided) => {
    // Find the method config
    const methods = posSettings?.paymentMethods || [
      { id: '1', name: 'EFECTIVO', openDrawer: true, printReceipt: true }
    ];
    const methodConfig = methods.find(m => m.name === methodName) || methods[0];

    const saleData = {
      customerId: selectedCustomer,
      items: ticketItems,
      subtotal,
      discountPercent,
      discountAmount,
      total,
      status: 'PAID',
      paymentMethod: methodConfig.name,
      amountProvided: amountProvided,
      change: amountProvided - total,
      timestamp: new Date().toISOString(),
      shiftId: activeShift?.id
    };
    
    // Add logic here to deduct from bodega using dispatchItem (Phase 4 later)
    
    if (activeSuspendedId) {
      updatePosSale(activeSuspendedId, saleData);
    } else {
      addPosSale(saleData);
    }
    
    // Clear ticket
    setTicketItems([]);
    setActiveSuspendedId(null);
    setSelectedCustomer('');
    
    // Print trigger logic based on config
    let autoPrint = methodConfig.printReceipt;
    let autoDrawer = methodConfig.openDrawer;

    if (autoPrint || autoDrawer) {
      handlePrintReceipt(saleData, autoDrawer, autoPrint);
    } else if (confirm('Venta cobrada con éxito. ¿Desea imprimir recibo?')) {
      handlePrintReceipt(saleData, true, true);
    }
  };

  const handlePrintReceipt = (sale, openDrawer = true, printReceipt = true) => {
    setLastSale(sale);
    
    if (openDrawer) {
      // Simulate drawer open via ESC/POS command
      const code = posSettings?.cashDrawerCode || '\\x1B\\x70\\x00\\x19\\xFA';
      console.log(`--- ENVIANDO COMANDO DE APERTURA DE CAJÓN: ${code} ---`);
    }
    
    if (printReceipt) {
      handleReprintSale(sale);
    }
  };

  const handleReprintSale = (saleToPrint) => {
    if (!saleToPrint) return;
    const saleCustomer = customers?.find(c => c.id === saleToPrint.customerId);
    const receiptHtml = generateReceiptHTML(saleToPrint, saleCustomer);
    setTimeout(() => {
      printHTML(receiptHtml, 'Recibo de Venta (Copia)');
    }, 100);
  };

  // GRID RENDER LOGIC --
  // Include all items that are products or fritos, regardless of price (variable price)
  const sellableItems = inventory.filter(i => i.type === 'PRODUCTO' || i.type === 'FRITO' || i.type === 'BEBIDA');
  
  // If in root, show folders + unassigned items. If in folder, show items assigned to that folder.
  const displayedFolders = currentFolder ? [] : posCategories;
  const displayedItems = currentFolder 
    ? sellableItems.filter(i => i.posCategoryId === currentFolder)
    : sellableItems.filter(i => !i.posCategoryId); // Items outside any folder

  return (
    <div className="flex flex-col h-screen w-full bg-[#1e1f26] text-white overflow-hidden font-sans">

      {/* ══════ HEADER GLOBAL ══════ */}
      {/* Overlay para cerrar hamburguesa al click fuera */}
      {showHamburgerMenu && (
        <div className="fixed inset-0 z-[45]" onClick={() => setShowHamburgerMenu(false)} />
      )}
      <div className="w-full shrink-0 bg-[#111318] border-b border-gray-800 flex items-center gap-2 px-3 h-14 shadow-lg shadow-black/40">

        {/* ── Logo ── */}
        <span className="font-black text-sm bg-yellow-400 text-gray-900 px-3 py-2 rounded-xl whitespace-nowrap shrink-0 select-none">🍟 Caja FM</span>

        {/* ── Buscador ── */}
        <div className="relative shrink-0 w-36 sm:w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={searchInputRef} className="w-full bg-[#0c0d11] border border-gray-700 rounded-full py-2 pl-9 pr-3 text-sm font-bold text-white outline-none focus:border-chunky-main placeholder-gray-600 transition-all" placeholder="Escáner..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={handleBarcodeSearch} />
        </div>

        <div className="w-px h-7 bg-gray-700 shrink-0" />

        {/* ── Botones de pago — SIEMPRE VISIBLES ── */}
        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          {!activeShift ? (
            <button
              className="shrink-0 bg-red-600 text-white rounded-xl px-3 py-2 text-xs font-black border-none animate-pulse active:scale-95 transition-all whitespace-nowrap min-h-[36px]"
              onClick={() => setShowShiftModal(true)}
            >⚠️ ABRIR CAJA</button>
          ) : (
            <>
              {(posSettings?.paymentMethods || [{ id: '1', name: 'EFECTIVO' }]).map((pm, idx) => (
                <button
                  key={pm.id || pm.name}
                  className={`shrink-0 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-black border-none shadow-md active:scale-95 transition-all whitespace-nowrap min-h-[36px] ${
                    idx === 0
                      ? 'bg-[#1c6b3a] active:bg-[#155a30] text-green-100'
                      : 'bg-[#0d6ebd] active:bg-[#0a5fa8] text-blue-100'
                  }`}
                  onClick={() => ticketItems.length > 0 && handleProcessPayment(pm.name, total)}
                >{pm.name}</button>
              ))}
              <button
                className="shrink-0 bg-[#4a4e69] active:bg-[#35384f] text-white rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-none shadow-md active:scale-95 transition-all whitespace-nowrap min-h-[36px]"
                onClick={() => ticketItems.length > 0 && setShowPaymentModal(true)}
              >💳 Pago</button>
            </>
          )}
        </div>

        {/* ── Hamburguesa ── */}
        <div className="relative shrink-0">
          <button
            className="w-11 h-11 flex flex-col items-center justify-center gap-[5px] border border-gray-600 text-gray-300 bg-gray-800/50 rounded-xl active:scale-95 active:bg-gray-700 transition-all"
            onClick={() => setShowHamburgerMenu(v => !v)}
            title="Más opciones"
          >
            <span className="w-5 h-[2px] bg-current rounded-full" />
            <span className="w-5 h-[2px] bg-current rounded-full" />
            <span className="w-5 h-[2px] bg-current rounded-full" />
          </button>

          {/* Dropdown */}
          {showHamburgerMenu && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-[46] bg-[#1e1f26] border border-gray-700 rounded-2xl shadow-2xl shadow-black/60 min-w-[200px] overflow-hidden animate-modal-in">
              {/* Cierre Z / Abrir caja */}
              {!activeShift ? (
                <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-red-400 hover:bg-red-950/40 transition-colors" onClick={() => { setShowShiftModal(true); setShowHamburgerMenu(false); }}>
                  <span className="text-base">⚠️</span> Abrir Caja
                </button>
              ) : (
                <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-gray-200 hover:bg-gray-800 transition-colors" onClick={() => { setShowClosingModal(true); setShowHamburgerMenu(false); }}>
                  <span className="text-base">🔴</span> Cierre Z
                </button>
              )}

              {activeShift && (
                <>
                  <div className="h-px bg-gray-800" />
                  <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-green-300 hover:bg-green-950/40 transition-colors" onClick={() => { setPinPromptConfig({ message: 'Contraseña de Ingresos', expectedPin: '7', onSuccess: () => setShowIncomesModal(true) }); setShowHamburgerMenu(false); }}>
                    <span className="text-base">💰</span> Ingresos
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-red-300 hover:bg-red-950/40 transition-colors" onClick={() => { setPinPromptConfig({ message: 'Contraseña de Gastos', expectedPin: '8', onSuccess: () => setShowExpensesModal(true) }); setShowHamburgerMenu(false); }}>
                    <span className="text-base">💸</span> Gastos
                  </button>
                </>
              )}

              <div className="h-px bg-gray-800" />
              <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-gray-200 hover:bg-gray-800 transition-colors" onClick={() => { setShowSuspendedModal(true); setShowHamburgerMenu(false); }}>
                <span className="text-base">🕑</span> Ventas en Espera
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-gray-200 hover:bg-gray-800 transition-colors" onClick={() => { setShowHistoryModal(true); setShowHamburgerMenu(false); }}>
                <span className="text-base">📜</span> Historial
              </button>
              {lastSale && (
                <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-chunky-main hover:bg-yellow-950/40 transition-colors" onClick={() => { handleReprintSale(lastSale); setShowHamburgerMenu(false); }}>
                  <span className="text-base">🖨️</span> Reimprimir último
                </button>
              )}

              <div className="h-px bg-gray-800" />
              <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-amber-300 hover:bg-amber-950/40 transition-colors" onClick={() => { setShowContratasPanel(true); setShowHamburgerMenu(false); }}>
                <span className="text-base">🤝</span> Contratas
              </button>

              <div className="h-px bg-gray-800" />
              <button className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-gray-400 hover:bg-gray-800 transition-colors" onClick={() => { signOut(); setShowHamburgerMenu(false); }}>
                <span className="text-base">↩️</span> Cerrar sesión
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ══════ CONTENIDO: Ticket + Productos ══════ */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

      {/* ─── TICKET — drawer en móvil, columna en desktop ─── */}
      {showMobileTicket && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setShowMobileTicket(false)} />
      )}
      <div className={`
        md:w-[270px] lg:w-[300px] xl:w-[340px] md:relative md:translate-y-0 md:max-h-none md:border-r md:border-t-0
        fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800
        flex flex-col bg-[#16171d]
        transition-transform duration-300 ease-out
        max-h-[88vh]
        ${showMobileTicket ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
      `}>
        {/* Handle para cerrar en móvil */}
        <div className="md:hidden flex items-center justify-between px-4 pt-3 pb-1 border-b border-gray-800">
          <span className="font-black text-sm text-white">🧾 Ticket ({ticketItems.length})</span>
          <button onClick={() => setShowMobileTicket(false)} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        
        {/* Ticket Header & Customer */}
        <div className="p-4 border-b border-gray-800 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="font-black text-xl text-chunky-main">Nueva Venta</h2>
            <span className="text-gray-500 text-xs">{new Date().toLocaleDateString('es-CO')}</span>
          </div>
          
          <div className="flex gap-2">
            <select 
              className="flex-1 min-w-0 bg-[#1e1f26] text-white border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-chunky-main"
              value={selectedCustomer || ''}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="">Consumidor Final</option>
              {customers.map(c => {
                const typeName = c.typeId ? (customerTypes.find(t => t.id === c.typeId)?.name || '') : '';
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} {typeName ? `[${typeName}]` : ''} {c.discountPercent > 0 ? `(-${c.discountPercent}%)` : ''}
                  </option>
                );
              })}
            </select>
            <button
              className="shrink-0 w-10 h-10 flex items-center justify-center bg-chunky-main text-gray-900 rounded-lg font-black text-lg active:scale-95 transition-all"
              onClick={() => setShowAddClientModal(true)}
              title="Agregar nuevo cliente"
            >+</button>
          </div>

          {/* Contrata Account Summary */}
          {(() => {
            const c = customers.find(c => c.id === selectedCustomer);
            if (!c || !c.typeId) return null;
            const type = customerTypes.find(t => t.id === c.typeId);
            const balance = getContrataBalance ? getContrataBalance(c.id) : 0;
            return (
              <div className="mt-2 bg-[#0c0d11] border border-gray-800 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${type?.color || 'bg-blue-500'}`} />
                    <span className="text-xs font-bold text-gray-400">{type?.name}</span>
                  </div>
                  {balance > 0
                    ? <span className="text-xs font-black text-red-400 bg-red-950/40 px-2 py-0.5 rounded-full">Debe {formatMoney(balance)}</span>
                    : <span className="text-xs font-bold text-green-400 bg-green-950/40 px-2 py-0.5 rounded-full">Al día ✓</span>
                  }
                </div>
                <button
                  className="w-full mt-1 text-xs font-bold text-chunky-main bg-chunky-main/10 hover:bg-chunky-main/20 rounded-lg py-2 active:scale-95 transition-all"
                  onClick={() => setShowClientAccountModal(true)}
                >
                  📝 Ver cuenta & historial
                </button>
              </div>
            );
          })()}
        </div>

        {/* Ticket Items List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {ticketItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              <p className="mt-4 font-bold text-sm uppercase tracking-wider">Añade productos</p>
            </div>
          ) : (
            <div className="space-y-1">
              {ticketItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 bg-[#1e1f26] rounded-xl border border-transparent hover:border-gray-700 transition-all">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm truncate">{item.name}</span>
                      <span className="font-black text-sm text-chunky-secondary shrink-0 ml-2">{formatMoney(item.price * item.qty)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] font-bold ${item.isCustomPrice ? 'text-amber-500' : 'text-gray-500'}`}>
                        {formatMoney(item.price)} c/u
                        {item.isCustomPrice && <span className="ml-1 bg-amber-500/20 text-amber-500 px-1 rounded">VIP</span>}
                      </span>
                      {/* Qty controls */}
                      <div className="flex items-center bg-[#0c0d11] rounded-lg border border-gray-800">
                        <button className="w-8 h-8 flex items-center justify-center text-gray-400 active:text-white active:bg-gray-700 rounded-l-lg transition-colors" onClick={() => handleQtyChange(item.id, -1)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <span 
                          className="w-10 text-center font-black text-sm cursor-pointer text-chunky-main active:scale-90 transition-all select-none" 
                          onClick={() => {
                            const newQty = prompt(`Cantidad para ${item.name}:`, item.qty);
                            if (newQty !== null && !isNaN(newQty) && parseInt(newQty) > 0) {
                              setTicketItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: parseInt(newQty) } : i));
                            }
                          }}
                        >{item.qty}</span>
                        <button className="w-8 h-8 flex items-center justify-center text-gray-400 active:text-white active:bg-gray-700 rounded-r-lg transition-colors" onClick={() => handleQtyChange(item.id, 1)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Delete */}
                  <button 
                    className="shrink-0 w-8 h-8 flex items-center justify-center bg-red-500/20 text-red-400 rounded-lg active:bg-red-500 active:text-white active:scale-90 transition-all"
                    onClick={() => setTicketItems(prev => prev.filter(i => i.id !== item.id))}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket Footer (Totals & Fast Actions) */}
        <div className="p-4 border-t border-gray-800 bg-[#121318] flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm font-bold text-gray-400">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          {discountPercent > 0 && (
            <div className="flex justify-between items-center text-sm font-bold text-orange-400">
              <span>Descuento ({discountPercent}%)</span>
              <span>-{formatMoney(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-800">
            <span className="text-xl font-black uppercase tracking-wider text-gray-300">Total</span>
            <span className="text-4xl font-black text-white">{formatMoney(total)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <button className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 active:scale-95 transition-all" onClick={() => { setTicketItems([]); setActiveSuspendedId(null); }}>
              <span className="text-lg">🗑</span>
              <span className="text-[10px] font-black">Anular</span>
            </button>
            <button
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 active:scale-95 transition-all disabled:opacity-30"
              disabled={ticketItems.length === 0}
              onClick={handlePrintOrder}
            >
              <span className="text-lg">🖨</span>
              <span className="text-[10px] font-black">Pedido</span>
            </button>
            <button className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl active:scale-95 transition-all ${activeSuspendedId ? 'bg-orange-500 text-white' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'}`} onClick={handleSaveSale}>
              <span className="text-lg">{activeSuspendedId ? '✏️' : '💾'}</span>
              <span className="text-[10px] font-black">{activeSuspendedId ? 'Actualizar' : 'Espera'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── PANEL DERECHO ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Categorías */}
        <div className="bg-[#111318] px-3 py-2 border-b border-[#1c1d24] flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
          <Button
            className={`rounded-full py-2.5 px-5 border-none font-black text-sm whitespace-nowrap active:scale-95 transition-transform min-h-[40px] ${!currentFolder ? 'bg-chunky-main text-chunky-dark' : 'bg-[#2a2d38] text-gray-400 active:bg-[#343846]'}`}
            onClick={() => setCurrentFolder(null)}
          >
            🏠 Inicio (Todas)
          </Button>
          <div className="w-px h-6 bg-gray-800 shrink-0" />
          {posCategories?.map(cat => (
            <Button
                key={cat.id}
                className={`rounded-full py-2.5 px-5 font-black text-sm border-none whitespace-nowrap active:scale-95 transition-transform min-h-[40px] ${currentFolder === cat.id ? `${cat.color} text-white ring-2 ring-white/50 shadow-lg` : 'bg-[#21242d] text-gray-300 active:bg-[#3a3d48] ring-1 ring-gray-800'}`}
                onClick={() => setCurrentFolder(cat.id)}
              >
                {cat.name}
              </Button>
          ))}
        </div>

        {/* Grid Area */}
        <div className="flex-1 p-4 overflow-y-auto scrollbar-thin bg-gradient-to-br from-[#1e1f26] to-[#16171d]">
          <div className={`grid gap-3 sm:gap-4 pb-20 ${
              posSettings?.gridSize === 'small' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8' :
              posSettings?.gridSize === 'large' ? 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' :
              'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          }`}>
            
            {/* Folders (Removed per user request) */}

            {/* Show Products */}
            {displayedItems.map(item => (
              <button 
                key={item.id} 
                className="aspect-square bg-[#21242d] hover:bg-[#2a2d38] border-2 border-transparent hover:border-chunky-main/50 rounded-[32px] flex flex-col justify-between p-4 text-left shadow-xl shadow-black/20 hover:shadow-2xl hover:-translate-y-2 active:scale-95 transition-all duration-300 relative overflow-hidden group"
                onClick={() => handleItemAdd(item)}
              >
                {/* Background Image if available */}
                {item.imageUrl && (
                  <div className="absolute top-0 left-0 right-0 bottom-1/3 overflow-hidden rounded-t-[32px]">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.target.style.display = 'none'; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#21242d] via-transparent to-transparent"></div>
                  </div>
                )}

                <div className="absolute inset-0 bg-chunky-main/5 opacity-0 group-hover:opacity-100 transition-opacity z-10 duration-300 pointer-events-none"></div>
                
                <span className={`relative z-20 text-[10px] sm:text-xs font-black px-3 py-1 rounded-full inline-block w-max self-start shadow-sm border border-white/10 ${
                  item.type === 'FRITO' ? 'bg-yellow-500/90 text-yellow-950 backdrop-blur-md' :
                  item.type === 'CRUDO' ? 'bg-orange-500/90 text-orange-950 backdrop-blur-md' :
                  item.type === 'BEBIDA' ? 'bg-blue-500/90 text-blue-950 backdrop-blur-md' : 'bg-gray-100/20 text-white backdrop-blur-md'
                }`}>
                  {item.type}
                </span>

                <div className={`relative z-20 flex flex-col gap-1 w-full mt-auto mix-blend-plus-lighter`}>
                  <span className={`font-black leading-tight line-clamp-2 ${item.imageUrl ? 'text-white drop-shadow-lg' : 'text-gray-100'} ${posSettings?.gridSize === 'small' ? 'text-xs sm:text-sm' : posSettings?.gridSize === 'large' ? 'text-base sm:text-xl' : 'text-sm sm:text-base'}`} title={item.name}>{item.name.replace('Chorizo', 'Chor.')}</span>
                  <span className={`font-black tracking-tight ${item.imageUrl ? 'text-green-300 drop-shadow-md' : 'text-green-400'} ${posSettings?.gridSize === 'small' ? 'text-sm sm:text-base' : posSettings?.gridSize === 'large' ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>{formatMoney(item.price)}</span>
                </div>
              </button>
            ))}
          </div>

          {displayedItems.length === 0 && (!posCategories || posCategories.length === 0 || currentFolder) && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4 mt-20">
               <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
               <p className="font-bold text-lg">No hay productos con precio en esta sección</p>
               <p className="text-sm">Agrega precios en el Panel de Administrador para que aparezcan aquí.</p>
            </div>
          )}
        </div>
        
      </div>{/* fin panel derecho */}
      </div>{/* fin flex-1 contenido */}

      {/* ─── FAB móvil: abre el ticket ─── */}
      <button
        className="fixed bottom-5 right-5 z-20 md:hidden flex items-center gap-2 bg-chunky-main text-gray-900 font-black text-sm px-5 py-3.5 rounded-full shadow-2xl shadow-black/50 active:scale-95 transition-all"
        onClick={() => setShowMobileTicket(true)}
      >
        🛒
        {ticketItems.length > 0 && (
          <span className="bg-gray-900 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">{ticketItems.length}</span>
        )}
        <span>{ticketItems.length === 0 ? 'Ticket' : formatMoney(total)}</span>
      </button>

      {/* ─── MODALS ───────────────────────────────────────── */}

      {variablePriceProduct && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl p-6 flex flex-col items-center">
             <h3 className="font-black text-2xl text-white mb-2 text-center">{variablePriceProduct.name}</h3>
             <p className="text-gray-400 font-bold mb-6 text-center text-sm">Ingresa el precio de venta (Precio Variable).</p>
             
             <div className="relative mb-6 w-full">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-gray-500">$</span>
                <input 
                  autoFocus 
                  type="number"
                  value={variablePriceInput}
                  onChange={e => setVariablePriceInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                       const price = parseInt(variablePriceInput);
                       if (isNaN(price) || price <= 0) return alert('Ingresa un precio válido');
                       handleItemAdd(variablePriceProduct, price);
                       setVariablePriceProduct(null);
                       setVariablePriceInput('');
                    }
                  }}
                  className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-chunky-main rounded-[24px] py-4 pl-14 pr-6 text-4xl font-black text-white outline-none text-center shadow-inner transition-colors"
                  placeholder="0"
                />
             </div>

             <div className="flex gap-3 w-full">
                <button onClick={() => { setVariablePriceProduct(null); setVariablePriceInput(''); }} className="flex-1 py-4 rounded-[20px] bg-gray-800 text-gray-300 font-bold text-lg hover:bg-gray-700 transition-colors active:scale-95">
                  Cancelar
                </button>
                <button onClick={() => {
                  const price = parseInt(variablePriceInput);
                  if (isNaN(price) || price <= 0) return alert('Ingresa un precio válido');
                  handleItemAdd(variablePriceProduct, price);
                  setVariablePriceProduct(null);
                  setVariablePriceInput('');
                }} className="flex-1 py-4 rounded-[20px] bg-chunky-main text-chunky-dark font-black text-lg shadow-lg hover:scale-105 transition-all active:scale-95">
                  Confirmar
                </button>
             </div>
          </div>
        </div>
      )}
      {showIncomesModal && <IncomesModal onClose={() => setShowIncomesModal(false)} />}
      {showExpensesModal && <ExpensesModal onClose={() => setShowExpensesModal(false)} />}

      {pinPromptConfig && (
        <PinPromptModal 
          message={pinPromptConfig.message}
          expectedPin={pinPromptConfig.expectedPin}
          onSuccess={() => {
            pinPromptConfig.onSuccess();
            setPinPromptConfig(null);
          }}
          onClose={() => setPinPromptConfig(null)}
        />
      )}

      {showPaymentModal && (
        <PaymentModal 
          total={total}
          paymentMethods={posSettings?.paymentMethods?.map(m => m.name) || ['EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TARJETA']}
          onClose={() => setShowPaymentModal(false)} 
          onConfirm={(methodName, amount) => {
            setShowPaymentModal(false);
            handleProcessPayment(methodName, amount);
          }} 
        />
      )}

      {showSuspendedModal && (
        <SuspendedSalesModal
          sales={(posSales || []).filter(s => s.status === 'SUSPENDED')}
          onClose={() => setShowSuspendedModal(false)}
          onLoad={handleLoadSuspended}
        />
      )}

      {showHistoryModal && (
        <SalesHistoryModal
          sales={(posSales || []).filter(s => s.shiftId === activeShift?.id && s.status === 'PAID').sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))}
          customers={customers}
          onClose={() => setShowHistoryModal(false)}
          onReprint={handleReprintSale}
        />
      )}

      {showShiftModal && !activeShift && (
        <ShiftOpenModal onConfirm={handleOpenShift} />
      )}

      {showLogoutPromptModal && (
        <LogoutPromptModal 
          onContinue={() => setShowLogoutPromptModal(false)} 
          onLogout={signOut} 
        />
      )}

      {showClosingModal && activeShift && (
        <ShiftCloseModal 
          shift={activeShift} 
          sales={(posSales || []).filter(s => s.shiftId === activeShift.id && s.status === 'PAID')} 
          expenses={(posExpenses || []).filter(e => e.shiftId === activeShift.id)}
          onClose={() => setShowClosingModal(false)}
          onConfirm={handleCloseShift} 
        />
      )}

      {showExpenseModal && activeShift && (
        <ShiftExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onConfirm={handleAddExpense}
        />
      )}

      {showAddClientModal && (
        <NewClientModal
          customerTypes={customerTypes}
          onClose={() => setShowAddClientModal(false)}
          onSave={(clientData) => {
            addCustomer(clientData);
            // Auto-select the new client after a brief delay for state to update
            setTimeout(() => {
              const store = useInventoryStore.getState();
              const newest = (store.customers || []).sort((a, b) => b.id.localeCompare(a.id))[0];
              if (newest) setSelectedCustomer(newest.id);
            }, 200);
            setShowAddClientModal(false);
          }}
        />
      )}

      {showContratasPanel && (
        <ContratasPanelModal
          customers={customers}
          customerTypes={customerTypes}
          posSales={posSales}
          contrataPayments={contrataPayments}
          getContrataBalance={getContrataBalance}
          onAddPayment={addContrataPayment}
          onClose={() => setShowContratasPanel(false)}
          formatMoney={formatMoney}
          updatePosSale={updatePosSale}
        />
      )}

      {showClientAccountModal && selectedCustomer && (() => {
        const c = customers.find(c => c.id === selectedCustomer);
        if (!c || !c.typeId) return null;
        return (
          <ClientAccountModal
            customer={c}
            customerTypes={customerTypes}
            posSales={posSales}
            contrataPayments={contrataPayments}
            getContrataBalance={getContrataBalance}
            onAddPayment={addContrataPayment}
            onClose={() => setShowClientAccountModal(false)}
          />
        );
      })()}
    </div>
  );
}

// ─── Contratas Full Panel (POS) ───
function ContratasPanelModal({ customers, customerTypes, posSales, contrataPayments, getContrataBalance, onAddPayment, onClose, formatMoney, updatePosSale }) {
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [editTotal, setEditTotal] = useState('');
  const [filter, setFilter] = useState('all'); // all, debtors, clean

  const contrataClients = (customers || []).filter(c => c.typeId);

  const clientsWithBalance = contrataClients.map(c => {
    const type = customerTypes.find(t => t.id === c.typeId);
    const balance = getContrataBalance ? getContrataBalance(c.id) : 0;
    const totalSales = (posSales || []).filter(s => s.customerId === c.id && s.status === 'PAID').length;
    return { ...c, type, balance, totalSales };
  }).sort((a, b) => b.balance - a.balance);

  const filtered = filter === 'debtors' ? clientsWithBalance.filter(c => c.balance > 0)
    : filter === 'clean' ? clientsWithBalance.filter(c => c.balance === 0)
    : clientsWithBalance;

  const totalDebt = clientsWithBalance.reduce((acc, c) => acc + c.balance, 0);
  const totalDebtors = clientsWithBalance.filter(c => c.balance > 0).length;

  const selectedClient = contrataClients.find(c => c.id === selectedClientId);
  const selectedType = selectedClient ? customerTypes.find(t => t.id === selectedClient.typeId) : null;
  const selectedBalance = selectedClient && getContrataBalance ? getContrataBalance(selectedClient.id) : 0;

  const clientSales = selectedClient ? (posSales || [])
    .filter(s => s.customerId === selectedClient.id && s.status === 'PAID')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];

  const clientPayments = selectedClient ? (contrataPayments || [])
    .filter(p => p.customerId === selectedClient.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date)) : [];

  const handlePay = () => {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0 || !selectedClient) return;
    onAddPayment({
      customerId: selectedClient.id,
      customerName: selectedClient.name,
      amount: amt,
      method: payMethod,
      note: payNote.trim(),
    });
    setPayAmt('');
    setPayNote('');
  };

  const handleSaveEditSale = (saleId) => {
    const val = parseFloat(editTotal);
    if (!val || val <= 0) return;
    updatePosSale(saleId, { total: val, creditAmount: val });
    setEditingSaleId(null);
    setEditTotal('');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2">
      <div className="bg-[#13141a] border border-gray-700/50 rounded-[28px] w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">🤝 Control de Contratas</h2>
            <p className="text-xs text-gray-500 font-bold mt-0.5">{contrataClients.length} clientes · {totalDebtors} deben · Total deuda: <span className="text-red-400">{formatMoney(totalDebt)}</span></p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors text-lg">✕</button>
        </div>

        <div className="flex-1 flex overflow-hidden">

          {/* Left: Client List */}
          <div className="w-72 border-r border-gray-800 flex flex-col shrink-0 overflow-hidden">
            {/* Filters */}
            <div className="flex gap-1 p-3 border-b border-gray-800 shrink-0">
              {[{k:'all', l:'Todos'}, {k:'debtors', l:'Deben'}, {k:'clean', l:'Al día'}].map(f => (
                <button key={f.k} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${filter === f.k ? 'bg-chunky-main text-chunky-dark' : 'bg-gray-800 text-gray-400'}`} onClick={() => setFilter(f.k)}>
                  {f.l}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && <p className="text-gray-600 text-sm font-bold text-center py-8">Sin clientes</p>}
              {filtered.map(c => (
                <button
                  key={c.id}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors ${selectedClientId === c.id ? 'bg-chunky-main/10 border-l-2 border-l-chunky-main' : 'hover:bg-gray-800/50'}`}
                  onClick={() => { setSelectedClientId(c.id); setEditingSaleId(null); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${c.type?.color || 'bg-blue-500'}`} />
                      <span className="font-bold text-white text-sm truncate">{c.name}</span>
                    </div>
                    {c.balance > 0
                      ? <span className="text-[10px] font-black text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded-full shrink-0 ml-1">{formatMoney(c.balance)}</span>
                      : <span className="text-[10px] font-bold text-green-400 shrink-0 ml-1">✓</span>
                    }
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{c.type?.name || 'Contrata'} · {c.totalSales} ventas</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Client Detail */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedClient ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-50 p-8">
                <span className="text-5xl mb-4">👈</span>
                <p className="font-bold text-sm">Selecciona un cliente</p>
              </div>
            ) : (
              <>
                {/* Client header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${selectedType?.color || 'bg-blue-500'} flex items-center justify-center text-white font-black text-lg`}>
                      {selectedClient.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-white text-base">{selectedClient.name}</h3>
                      <p className="text-[10px] text-gray-500">{selectedType?.name} {selectedClient.phone ? `· ${selectedClient.phone}` : ''} {selectedClient.document ? `· ${selectedClient.document}` : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 font-bold">SALDO</p>
                    <p className={`text-xl font-black ${selectedBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {selectedBalance > 0 ? formatMoney(selectedBalance) : 'Al día ✓'}
                    </p>
                  </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                  {/* Quick Payment */}
                  {selectedBalance > 0 && (
                    <div className="bg-green-950/30 border border-green-800/50 rounded-2xl p-4 space-y-2">
                      <h4 className="font-black text-green-300 text-xs">💵 Registrar Abono</h4>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">$</span>
                          <input type="number" placeholder="0" value={payAmt} onChange={e => setPayAmt(e.target.value)}
                            className="w-full bg-[#0c0d11] border border-gray-700 focus:border-green-500 rounded-xl py-2.5 pl-8 pr-3 text-base font-black text-white outline-none"
                            onKeyDown={e => { if (e.key === 'Enter') handlePay(); }}
                          />
                        </div>
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                          className="bg-[#0c0d11] border border-gray-700 rounded-xl py-2.5 px-3 text-xs font-bold text-white outline-none">
                          <option value="cash">💵 Efectivo</option>
                          <option value="transfer">📲 Transfer</option>
                        </select>
                      </div>
                      <input type="text" placeholder="Nota (opcional)" value={payNote} onChange={e => setPayNote(e.target.value)}
                        className="w-full bg-[#0c0d11] border border-gray-700 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none" />
                      <button onClick={handlePay} className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-3 font-black text-sm active:scale-[0.98] transition-all shadow-lg shadow-green-900/30">
                        ✓ Registrar Abono
                      </button>
                    </div>
                  )}

                  {/* Sales History */}
                  <div>
                    <h4 className="font-black text-white text-xs uppercase tracking-wider mb-2">📝 Historial de Pedidos ({clientSales.length})</h4>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {clientSales.length === 0 && <p className="text-gray-600 text-xs font-bold text-center py-6">Sin ventas</p>}
                      {clientSales.map(s => (
                        <div key={s.id} className="p-3 bg-[#1a1b22] rounded-xl border border-gray-800/50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              {editingSaleId === s.id ? (
                                <div className="flex gap-2 items-center">
                                  <span className="text-gray-500 text-xs">$</span>
                                  <input type="number" value={editTotal} onChange={e => setEditTotal(e.target.value)}
                                    className="w-24 bg-[#0c0d11] border border-chunky-main rounded-lg py-1 px-2 text-sm font-bold text-white outline-none"
                                    autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveEditSale(s.id); if (e.key === 'Escape') setEditingSaleId(null); }}
                                  />
                                  <button onClick={() => handleSaveEditSale(s.id)} className="text-green-400 text-xs font-bold">✓</button>
                                  <button onClick={() => setEditingSaleId(null)} className="text-gray-500 text-xs">✕</button>
                                </div>
                              ) : (
                                <p className="font-bold text-white text-sm">
                                  {formatMoney(s.total)}
                                  <button className="ml-2 text-[10px] text-gray-500 hover:text-chunky-main" onClick={() => { setEditingSaleId(s.id); setEditTotal(s.total.toString()); }}>✏️</button>
                                </p>
                              )}
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {new Date(s.timestamp).toLocaleDateString('es-CO')} {new Date(s.timestamp).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}
                                {s.items?.slice(0, 4).map(i => ` · ${i.qty}x ${i.name}`).join('')}
                              </p>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                              s.contrataPaymentMethod === 'credit' ? 'bg-red-950/50 text-red-400'
                              : s.paymentMethod === 'EFECTIVO' ? 'bg-green-950/50 text-green-400'
                              : 'bg-blue-950/50 text-blue-400'
                            }`}>
                              {s.contrataPaymentMethod === 'credit' ? 'CRÉDITO' : s.paymentMethod}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payments History */}
                  <div>
                    <h4 className="font-black text-white text-xs uppercase tracking-wider mb-2">💳 Historial de Abonos ({clientPayments.length})</h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {clientPayments.length === 0 && <p className="text-gray-600 text-xs font-bold text-center py-6">Sin abonos</p>}
                      {clientPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-green-950/20 rounded-xl">
                          <div>
                            <p className="font-black text-green-400 text-sm">+{formatMoney(p.amount)}</p>
                            <p className="text-[10px] text-gray-500">
                              {new Date(p.date).toLocaleDateString('es-CO')} {new Date(p.date).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}
                              {p.note ? ` · ${p.note}` : ''}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-green-400 bg-green-950/40 px-2 py-0.5 rounded-full">
                            {p.method === 'cash' ? '💵 Efectivo' : '📲 Transfer'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Client Account Modal (POS) ───
function ClientAccountModal({ customer, customerTypes, posSales, contrataPayments, getContrataBalance, onAddPayment, onClose }) {
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');

  const type = customerTypes.find(t => t.id === customer.typeId);
  const balance = getContrataBalance ? getContrataBalance(customer.id) : 0;

  // Credit sales for this client
  const creditSales = (posSales || [])
    .filter(s => s.customerId === customer.id && s.status === 'PAID')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 30);

  // Payments for this client
  const payments = (contrataPayments || [])
    .filter(p => p.customerId === customer.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

  const handlePay = () => {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return alert('Ingresa un monto válido');
    onAddPayment({
      customerId: customer.id,
      customerName: customer.name,
      amount: amt,
      method: payMethod,
      note: payNote.trim(),
    });
    setPayAmt('');
    setPayNote('');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl ${type?.color || 'bg-blue-500'} flex items-center justify-center text-white font-black text-xl`}>
              {customer.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-black text-white text-lg leading-tight">{customer.name}</h2>
              <p className="text-xs font-bold text-gray-400">
                {type?.name || 'Contrata'}
                {customer.document ? ` · ${customer.document}` : ''}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors">✕</button>
        </div>

        {/* Balance */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-400">Saldo pendiente</span>
          <span className={`text-2xl font-black ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {balance > 0 ? formatMoney(balance) : 'Al día ✓'}
          </span>
        </div>

        {/* Content scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Register Payment */}
          {balance > 0 && (
            <div className="bg-green-950/30 border border-green-800/50 rounded-2xl p-4 space-y-3">
              <h3 className="font-black text-green-300 text-sm">💵 Registrar Abono</h3>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">$</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={payAmt}
                    onChange={e => setPayAmt(e.target.value)}
                    className="w-full bg-[#0c0d11] border border-gray-700 focus:border-green-500 rounded-xl py-3 pl-8 pr-3 text-lg font-black text-white outline-none transition-colors"
                    onKeyDown={e => { if (e.key === 'Enter') handlePay(); }}
                  />
                </div>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="bg-[#0c0d11] border border-gray-700 rounded-xl py-3 px-3 text-sm font-bold text-white outline-none min-w-[120px]"
                >
                  <option value="cash">💵 Efectivo</option>
                  <option value="transfer">📲 Transfer</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Nota (opcional)"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                className="w-full bg-[#0c0d11] border border-gray-700 focus:border-green-500 rounded-xl py-2.5 px-3 text-sm font-bold text-white outline-none transition-colors"
              />
              <button
                onClick={handlePay}
                className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-3.5 font-black text-base active:scale-[0.98] transition-all shadow-lg shadow-green-900/30"
              >✓ Registrar Abono</button>
            </div>
          )}

          {/* Credit Sales */}
          <div>
            <h3 className="font-black text-white text-sm mb-2 uppercase tracking-wider">📝 Pedidos / Ventas</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {creditSales.length === 0 && <p className="text-gray-500 text-sm font-bold text-center py-4">Sin ventas registradas</p>}
              {creditSales.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2.5 bg-[#0c0d11] rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{formatMoney(s.total)}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(s.timestamp).toLocaleDateString('es-CO')} · {s.items?.length || 0} items
                      {s.items?.slice(0, 3).map(i => ` · ${i.qty}x ${i.name}`).join('')}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                    s.contrataPaymentMethod === 'credit'
                      ? 'bg-red-950/50 text-red-400'
                      : s.paymentMethod === 'EFECTIVO'
                        ? 'bg-green-950/50 text-green-400'
                        : 'bg-blue-950/50 text-blue-400'
                  }`}>
                    {s.contrataPaymentMethod === 'credit' ? 'CRÉDITO' : s.paymentMethod}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payments history */}
          <div>
            <h3 className="font-black text-white text-sm mb-2 uppercase tracking-wider">💳 Abonos / Pagos</h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {payments.length === 0 && <p className="text-gray-500 text-sm font-bold text-center py-4">Sin abonos</p>}
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2.5 bg-green-950/20 rounded-xl">
                  <div>
                    <p className="font-black text-green-400 text-sm">+{formatMoney(p.amount)}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(p.date).toLocaleDateString('es-CO')}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-green-400 bg-green-950/40 px-2 py-0.5 rounded-full">
                    {p.method === 'cash' ? 'Efectivo' : 'Transfer'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 bg-[#16171d] border-t border-gray-800">
          <button
            className="w-full py-3 rounded-2xl bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 active:scale-95 transition-all"
            onClick={onClose}
          >Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Client Modal (POS) ───
function NewClientModal({ customerTypes, onClose, onSave }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [typeId, setTypeId] = useState('');
  const [document, setDocument] = useState('');

  const selectedType = customerTypes.find(t => t.id === typeId);

  const handleSubmit = () => {
    if (!name.trim()) return alert('El nombre es obligatorio');
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      document: document.trim(),
      typeId: typeId || null,
      creditLimit: 0,
      discountPercent: selectedType?.globalDiscountPercent || 0,
      notes: '',
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-bounce-in">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-black text-white">Nuevo Cliente</h2>
          <p className="text-gray-400 text-sm font-bold mt-1">Registro rápido desde caja</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5 uppercase tracking-widest">Nombre *</label>
            <input
              autoFocus
              type="text"
              className="w-full bg-[#0c0d11] border border-gray-700 focus:border-chunky-main rounded-2xl py-3 px-4 text-base font-bold text-white outline-none transition-colors"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del cliente"
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5 uppercase tracking-widest">Teléfono</label>
            <input
              type="tel"
              className="w-full bg-[#0c0d11] border border-gray-700 focus:border-chunky-main rounded-2xl py-3 px-4 text-base font-bold text-white outline-none transition-colors"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="300 123 4567"
            />
          </div>

          {/* NIT / CC */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5 uppercase tracking-widest">NIT / CC</label>
            <input
              type="text"
              className="w-full bg-[#0c0d11] border border-gray-700 focus:border-chunky-main rounded-2xl py-3 px-4 text-base font-bold text-white outline-none transition-colors"
              value={document}
              onChange={e => setDocument(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {/* Tipo de Contrata */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1.5 uppercase tracking-widest">Tipo de Contrata</label>
            {customerTypes.length === 0 ? (
              <p className="text-gray-500 text-sm font-bold bg-[#0c0d11] rounded-2xl py-3 px-4 border border-gray-800">
                ⚠️ No hay tipos definidos. El admin debe crearlos en Contratas → Niveles.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`py-3 px-3 rounded-2xl border-2 text-sm font-bold transition-all ${!typeId ? 'border-chunky-main bg-chunky-main/10 text-chunky-main' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                  onClick={() => setTypeId('')}
                >
                  Sin tipo
                </button>
                {customerTypes.map(t => (
                  <button
                    key={t.id}
                    className={`py-3 px-3 rounded-2xl border-2 text-sm font-bold transition-all text-left ${
                      typeId === t.id
                        ? 'border-chunky-main bg-chunky-main/10 text-white'
                        : 'border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                    onClick={() => setTypeId(t.id)}
                  >
                    <span className={`inline-block w-3 h-3 rounded-full ${t.color || 'bg-blue-500'} mr-2`} />
                    {t.name}
                    {(t.globalDiscountPercent || 0) > 0 && (
                      <span className="text-xs text-chunky-main ml-1">(-{t.globalDiscountPercent}%)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-[#16171d] border-t border-gray-800 flex gap-4">
          <Button variant="outline" className="flex-1 rounded-[20px] py-4 font-bold border-gray-700 text-gray-400 hover:bg-gray-800" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-[2] rounded-[20px] py-4 font-black text-lg bg-chunky-main text-chunky-dark shadow-[0_4px_14px_0_rgba(255,200,50,0.39)] hover:scale-105 active:scale-95 transition-all"
            disabled={!name.trim()}
            onClick={handleSubmit}
          >
            Registrar Cliente
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Shift Modals Component ───
function ShiftOpenModal({ onConfirm }) {
  const [initialAmount, setInitialAmount] = useState('0');
  
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl p-6 flex flex-col items-center">
        <h2 className="text-2xl font-black text-white mb-2">Apertura de Caja</h2>
        <p className="text-gray-400 text-sm font-bold mb-6 text-center">Ingresa el dinero base con el que empiezas el turno.</p>
        
        <div className="w-full relative mb-6">
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-gray-500">$</span>
          <input 
            autoFocus type="number" 
            className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-chunky-main rounded-[24px] py-5 pl-14 pr-6 text-4xl font-black text-white outline-none text-center shadow-inner transition-colors"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.key === 'Enter' && onConfirm(initialAmount)}
          />
        </div>

        <Button className="w-full rounded-[20px] py-4 font-black text-lg bg-chunky-main text-chunky-dark shadow-[0_4px_14px_0_rgba(255,200,50,0.39)] hover:scale-105 active:scale-95 transition-all" onClick={() => onConfirm(initialAmount)}>
          Abrir Turno
        </Button>
      </div>
    </div>
  );
}

function ShiftCloseModal({ shift, sales, expenses, onClose, onConfirm }) {
  const [realCount, setRealCount] = useState('');
  
  // Calculate expected
  const initial = shift.initialAmount || 0;
  // Solo sumar efectivo para el cuadre (tarjetas y transferencias van a banco)
  const cashSales = sales.filter(s => s.paymentMethod === 'EFECTIVO').reduce((acc, sale) => acc + sale.total, 0);
  const otherSales = sales.filter(s => s.paymentMethod !== 'EFECTIVO').reduce((acc, sale) => acc + sale.total, 0);
  const totalExpenses = (expenses || []).reduce((acc, e) => acc + e.amount, 0);

  const expectedCashInDrawer = initial + cashSales - totalExpenses;
  const counted = parseFloat(realCount || 0);
  const difference = counted - expectedCashInDrawer;

  return (
     <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <span className="animate-pulse">🔴</span> Cierre de Caja (Reporte Z)
          </h2>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
           <div className="bg-[#16171d] rounded-[24px] p-5 border border-gray-800 space-y-3 text-sm font-bold text-gray-300 shadow-inner">
              <div className="flex justify-between"><span>Base Inicial:</span> <span>{formatMoney(initial)}</span></div>
              <div className="flex justify-between text-green-400"><span>Ventas Efectivo:</span> <span>+{formatMoney(cashSales)}</span></div>
              <div className="flex justify-between text-blue-400"><span>Ventas Electrónicas:</span> <span>+{formatMoney(otherSales)}</span></div>
              <div className="flex justify-between text-red-400 border-t border-gray-800 pt-3 mt-1"><span>Retiros (Salidas):</span> <span>-{formatMoney(totalExpenses)}</span></div>
              <div className="border-t border-gray-700 pt-3 flex justify-between text-xl text-white font-black mt-2">
                 <span>Efectivo Esperado en Cajón:</span> <span>{formatMoney(expectedCashInDrawer)}</span>
              </div>
           </div>

           <div>
             <label className="text-sm font-bold text-gray-400 block mb-2 text-center uppercase tracking-widest">Efectivo Real Contado</label>
             <div className="relative">
               <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-gray-500">$</span>
               <input 
                 autoFocus type="number" 
                 className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-chunky-main rounded-[24px] py-5 pl-14 pr-6 text-4xl font-black text-white outline-none text-center shadow-inner transition-colors"
                 value={realCount}
                 onChange={(e) => setRealCount(e.target.value)}
                 onFocus={(e) => e.target.select()}
               />
             </div>
             
             {realCount !== '' && (
                <div className={`mt-4 p-5 rounded-[20px] text-center font-black text-lg border ${difference === 0 ? 'bg-green-500/10 text-green-500 border-green-500/30' : difference > 0 ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                   {difference === 0 ? '¡CAJA CUADRADA EXACTA! ✅' : difference > 0 ? `SOBRANTE DE: ${formatMoney(difference)}` : `FALTANTE DE: ${formatMoney(Math.abs(difference))}`}
                </div>
             )}
           </div>
        </div>

        <div className="p-6 bg-[#16171d] border-t border-gray-800 flex gap-4">
          <Button variant="outline" className="flex-1 rounded-[20px] py-4 font-bold border-gray-700 text-gray-400 hover:bg-gray-800" onClick={onClose}>Cancelar</Button>
          <Button className="flex-[2] rounded-[20px] py-4 font-black text-lg bg-red-600 text-white shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] hover:scale-105 active:scale-95 hover:bg-red-500 transition-all" disabled={realCount === ''} onClick={() => onConfirm(realCount)}>
            Cerrar Turno Definitivo
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Expense Modal (Retiros / Pagos a proveedores) ───
function ShiftExpenseModal({ onClose, onConfirm }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Pago Proveedor');

  const isValid = parseFloat(amount) > 0 && reason.trim() !== '';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-bounce-in">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-black text-white">Registrar Retiro Gasto</h2>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-2 uppercase tracking-widest">Monto del Retiro</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-gray-500">$</span>
              <input 
                 autoFocus type="number" 
                 className="w-full bg-[#0c0d11] border border-gray-700 focus:border-orange-500 rounded-[20px] py-4 pl-14 pr-4 text-2xl font-black text-white outline-none transition-colors shadow-inner"
                 value={amount}
                 onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-2 uppercase tracking-widest">Motivo / Descripción</label>
            <input 
               type="text" 
               className="w-full bg-[#0c0d11] border border-gray-700 focus:border-orange-500 rounded-[20px] py-4 px-5 text-base font-bold text-white outline-none transition-colors shadow-inner"
               value={reason}
               onChange={(e) => setReason(e.target.value)}
               placeholder="Ej: Pago de hielo, proveedor..."
            />
          </div>
        </div>

        <div className="p-6 bg-[#16171d] border-t border-gray-800 flex gap-4">
          <Button variant="outline" className="flex-1 rounded-[20px] py-4 font-bold border-gray-700 text-gray-400 hover:bg-gray-800" onClick={onClose}>Cancelar</Button>
          <Button className="flex-[2] rounded-[20px] py-4 font-black text-lg bg-orange-600 text-white shadow-[0_4px_14px_0_rgba(234,88,12,0.39)] hover:scale-105 active:scale-95 hover:bg-orange-500 transition-all" disabled={!isValid} onClick={() => onConfirm(amount, reason)}>
            Registrar Retiro
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Modal Component ───
function PaymentModal({ total, paymentMethods, onClose, onConfirm }) {
  const defaultMethod = paymentMethods?.[0] || 'EFECTIVO';
  const [method, setMethod] = useState(defaultMethod);
  const [amount, setAmount] = useState(total.toString());
  
  const parsedAmt = parseFloat(amount || 0);
  const change = parsedAmt > total ? parsedAmt - total : 0;
  const isOk = parsedAmt >= total;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-bounce-in">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-black text-white">Cobrar Venta</h2>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {(paymentMethods || ['EFECTIVO']).map(m => (
              <button 
                key={m}
                className={`flex-1 min-w-[calc(25%-6px)] py-3.5 px-3 rounded-2xl font-black uppercase tracking-wide transition-all border-2 ${m.length > 8 ? 'text-[10px]' : 'text-xs'} ${method === m ? 'bg-chunky-main text-chunky-dark border-chunky-main shadow-lg shadow-chunky-main/20 scale-[1.02]' : 'bg-[#16171d] text-gray-400 border-gray-800 hover:border-gray-600 hover:text-gray-300'}`}
                onClick={() => { setMethod(m); setAmount(total.toString()); }}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="bg-[#16171d] rounded-[24px] p-8 flex flex-col items-center border border-gray-800 shadow-inner">
             <span className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-2">Total a Pagar</span>
             <span className="text-6xl font-black text-white drop-shadow-md">{formatMoney(total)}</span>
          </div>

          <div>
             <label className="text-sm font-bold text-gray-400 block mb-2 uppercase tracking-widest text-center">Monto entregado por el cliente</label>
             <div className="relative">
               <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-500">$</span>
               <input 
                 autoFocus
                 type="number" 
                 className="w-full bg-[#0c0d11] border-2 border-gray-700 focus:border-chunky-main rounded-[24px] py-5 pl-14 pr-6 text-4xl font-black text-white outline-none text-center shadow-inner transition-colors"
                 value={amount}
                 onChange={(e) => setAmount(e.target.value)}
                 onFocus={(e) => e.target.select()}
                 onKeyDown={(e) => { if (e.key === 'Enter' && isOk) onConfirm(method, parsedAmt); }}
               />
             </div>
             {change > 0 && (
               <div className="mt-4 flex justify-between items-center bg-green-500/10 border border-green-500/30 rounded-[20px] p-5">
                  <span className="font-bold text-green-500 uppercase tracking-widest">Cambio (Vuelto)</span>
                  <span className="text-3xl font-black text-green-500">{formatMoney(change)}</span>
               </div>
             )}
          </div>
        </div>

        <div className="p-6 bg-[#16171d] border-t border-gray-800 flex gap-4">
          <Button variant="outline" className="flex-1 rounded-[20px] py-4 font-bold border-gray-700 text-gray-400 hover:bg-gray-800" onClick={onClose}>Cancelar</Button>
          <Button className="flex-[2] rounded-[20px] py-4 font-black text-lg bg-chunky-main text-chunky-dark shadow-[0_4px_14px_0_rgba(255,200,50,0.39)] hover:scale-105 active:scale-95 transition-all" disabled={!isOk} onClick={() => onConfirm(method, parsedAmt)}>
            Confirmar y Cobrar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Suspended Sales Modal Component ───
function SuspendedSalesModal({ sales, onClose, onLoad }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-bounce-in">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-2xl font-black text-white">Ventas en Espera</h2>
          <button className="text-gray-400 hover:text-white bg-[#16171d] p-2 rounded-full hover:bg-gray-800 transition-colors" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-50">
              <span className="text-5xl mb-4">🍽️</span>
              <p className="text-center text-gray-400 font-bold">No hay ventas pendientes de cobro.</p>
            </div>
          ) : (
            sales.map(s => (
              <div key={s.id} className="bg-[#16171d] border border-gray-800 rounded-[24px] p-5 flex justify-between items-center hover:border-gray-600 transition-all hover:shadow-lg group">
                <div>
                  <h3 className="font-black text-white text-lg mb-1">Total: <span className="text-chunky-main">{formatMoney(s.total)}</span></h3>
                  <p className="text-xs text-gray-400 font-bold">Fecha: {new Date(s.timestamp).toLocaleString('es-CO')}</p>
                  <p className="text-xs text-gray-500 mt-1 bg-[#21242d] inline-block px-2 py-1 rounded-md">{s.items.length} ítem(s) guardados.</p>
                </div>
                <Button className="rounded-[16px] bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] group-hover:scale-105 active:scale-95 transition-all" onClick={() => onLoad(s)}>
                  Recuperar
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sales History Modal Component ───
function SalesHistoryModal({ sales, customers, onClose, onReprint }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-bounce-in">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <span>📜</span> Historial de Ventas (Turno Actual)
          </h2>
          <button className="text-gray-400 hover:text-white bg-[#16171d] p-2 rounded-full hover:bg-gray-800 transition-colors" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-3 scrollbar-thin flex-1 bg-[#121318]">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-50">
              <span className="text-5xl mb-4">🛒</span>
              <p className="text-center text-gray-400 font-bold">No hay ventas registradas en este turno.</p>
            </div>
          ) : (
            sales.map(s => {
              const customerName = customers?.find(c => c.id === s.customerId)?.name || 'Consumidor Final';
              return (
                <div key={s.id} className="bg-[#1e1f26] border border-gray-800 rounded-[20px] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-gray-600 transition-all hover:shadow-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="bg-[#2a2d38] text-gray-300 text-xs font-black px-2 py-1 rounded-lg">#{s.id.slice(-6)}</span>
                      <span className="text-xs text-gray-400 font-bold">{new Date(s.timestamp).toLocaleTimeString('es-CO')}</span>
                      <span className="text-[10px] font-black uppercase text-white px-2 py-0.5 rounded-full border border-gray-700 bg-gray-800">{s.paymentMethod}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 items-baseline">
                      <h3 className="font-black text-white text-xl">Total: <span className="text-chunky-main">{formatMoney(s.total)}</span></h3>
                      <p className="text-sm text-gray-400 font-bold truncate max-w-[200px]" title={customerName}>{customerName}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{s.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                  </div>
                  <Button 
                    className="w-full sm:w-auto rounded-[14px] bg-[#2a2d38] hover:bg-[#343846] text-white font-bold px-4 py-3 shadow-md border border-gray-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2" 
                    onClick={() => onReprint(s)}
                  >
                    <span>🖨️</span> Reimprimir
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Logout Prompt Modal ───
function LogoutPromptModal({ onContinue, onLogout }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl p-6 flex flex-col items-center text-center animate-bounce-in">
        <h2 className="text-2xl font-black text-white mb-2">Turno Cerrado ✅</h2>
        <p className="text-gray-400 text-sm font-bold mb-6">El informe Z ha sido procesado. ¿Qué deseas hacer ahora?</p>
        
        <div className="w-full flex flex-col gap-3">
          <Button className="w-full rounded-[20px] py-4 font-black text-lg bg-[#2a2d38] text-white hover:bg-[#343846] transition-all" onClick={onContinue}>
            Continuar en POS
          </Button>
          <Button className="w-full rounded-[20px] py-4 font-black text-lg bg-red-600 text-white shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] hover:bg-red-500 hover:scale-105 active:scale-95 transition-all" onClick={onLogout}>
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── PIN Prompt Modal Component ───
function PinPromptModal({ message, expectedPin, onSuccess, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === expectedPin) {
      onSuccess();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f26] border border-gray-700/50 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl p-6 flex flex-col items-center">
        <h2 className="text-xl font-black text-white mb-2">{message}</h2>
        <p className="text-gray-400 text-sm font-bold mb-6 text-center">Ingresa la clave numérica de acceso.</p>
        
        <form onSubmit={handleSubmit} className="w-full">
          <div className="w-full relative mb-6">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-500">🔒</span>
            <input 
              autoFocus 
              type="password" 
              className={`w-full bg-[#0c0d11] border-2 rounded-[24px] py-5 pl-14 pr-6 text-3xl font-black text-white outline-none text-center shadow-inner transition-colors ${error ? 'border-red-500 text-red-500' : 'border-gray-700 focus:border-chunky-main'}`}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="****"
            />
            {error && <p className="text-red-500 text-xs font-bold text-center mt-2 absolute w-full">Clave incorrecta</p>}
          </div>

          <div className="flex gap-3 mt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-[20px] py-3 font-bold border-gray-700 text-gray-400 hover:bg-gray-800" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 rounded-[20px] py-3 font-black bg-chunky-main text-chunky-dark hover:scale-[1.02] active:scale-95 transition-all" disabled={!pin}>Ingresar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
