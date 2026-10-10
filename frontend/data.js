/* Kaunter demo data. SYNTHETIC: no real people, receipts or customers.
   WorkBuddy overwrites this file with the owner's parsed data; the page only reads it.
   Dates are YYYY-MM-DD, times HH:MM (24h), money in RM. */
(function () {
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var d = function (n) {
    var x = new Date();
    x.setDate(x.getDate() + n);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  };
  var stamp = new Date();
  stamp.setHours(10, 20, 0, 0);

  window.KAUNTER_DATA = {
    demo: true,
    owner: { name: 'Kai' },
    generatedAt: stamp.toISOString(),

    events: [
      { id: 'e1', title: 'Call pembekal tepung (flour price)', date: d(0), time: '15:30', src: 'meeting' },
      { id: 'e2', title: 'Bank appointment: business account', date: d(1), time: '10:00', src: 'chat' },
      { id: 'e3', title: 'Hantar stok ke pelanggan katering', date: d(3), time: '09:00', src: 'meeting' },
      { id: 'e4', title: 'Accountant: monthly review', date: d(6), time: '14:00', src: 'chat' }
    ],

    todo: [
      { id: 't1', text: 'Hantar invois ke pelanggan katering', due: d(0), done: false, src: 'meeting' },
      { id: 't2', text: 'Order more cooking oil', due: d(1), done: false, src: 'chat' },
      { id: 't3', text: 'Bayar sewa kedai', due: d(-2), done: false, src: 'meeting' },
      { id: 't4', text: 'Check cold room temperature log', due: d(0), done: true, src: 'note' },
      { id: 't5', text: 'Ask accountant about SST filing', due: d(4), done: false, src: 'meeting' }
    ],

    reminders: [
      { id: 'r1', text: 'Collect parcel from courier', date: d(0), time: '17:00', src: 'chat' },
      { id: 'r2', text: 'Ingat telefon pembekal esok pagi', date: d(1), time: '09:00', src: 'meeting' },
      { id: 'r3', text: 'Renew business licence', date: d(12), time: '09:00', src: 'note' }
    ],

    sales: {
      days: [
        { date: d(-6), amount: 980 },
        { date: d(-5), amount: 1240 },
        { date: d(-4), amount: 860 },
        { date: d(-3), amount: 1510 },
        { date: d(-2), amount: 1320 },
        { date: d(-1), amount: 1890 },
        { date: d(0), amount: 1240 }
      ]
    },

    spend: [
      { id: 's1', vendor: 'Pasar borong', category: 'Stock', amount: 312.4, src: 'photo', conf: 0.96, date: d(0) },
      { id: 's2', vendor: 'Kedai alat tulis', category: 'Supplies', amount: 48.9, src: 'photo', conf: 0.91, date: d(-1) },
      { id: 's3', vendor: 'TNB bill', category: 'Utilities', amount: 286.1, src: 'pdf', conf: 0.98, date: d(-2) },
      { id: 's4', vendor: 'Grab delivery', category: 'Transport', amount: 23, src: 'chat', conf: 0.62, date: d(-3) }
    ],

    meetings: [
      {
        id: 'm1',
        title: 'Weekly stock and pricing check',
        date: d(-1),
        people: 3,
        decisions: [
          'Raise nasi lemak box price by RM0.50 from Monday',
          'Switch flour supplier if quote is above RM62 per bag',
          'Hire one part-timer for weekends'
        ],
        actions: 4
      },
      { id: 'm2', title: 'Catering order: planning call', date: d(-4), people: 2, decisions: [], actions: 2 },
      { id: 'm3', title: 'Landlord: rent schedule', date: d(-9), people: 2, decisions: [], actions: 1 }
    ],

    owe: {
      toMe: [
        { id: 'o1', who: 'Pelanggan katering', amount: 1850, due: d(-3) },
        { id: 'o2', who: 'Kedai runcit (repeat buyer)', amount: 420, due: d(4) }
      ],
      iOwe: [
        { id: 'o3', who: 'Pembekal tepung', amount: 960, due: d(2) },
        { id: 'o4', who: 'Sewa kedai', amount: 1500, due: d(-2) }
      ]
    },

    pack: {
      month: d(0).slice(0, 7),
      receipts: { have: 18, need: 22 },
      salesSheet: true,
      bank: false,
      folder: 'output/' + d(0).slice(0, 7) + '/'
    }
  };
})();
