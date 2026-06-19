/**
 * Fuel QR Registration System — Frontend JS  v2.1
 * jQuery is used in 5 distinct ways:
 *  1. DOM Manipulation & Event Handling  (.on(), .hide(), .show(), .addClass(), .removeClass())
 *  2. AJAX Calls                         ($.ajax, $.get)
 *  3. Form Serialisation & Validation    (.val(), $.each(), .prop())
 *  4. Dynamic Table Filtering            ($.fn + keyup + .filter())
 *  5. Animation & UI Effects             (.fadeIn(), .fadeOut(), .slideDown())
 */

const API = '/api/vehicles';

$(document).ready(function () {

  // ── Health check on page load ────────────────────────────────────────────
  checkHealth();

  // ── 1. Tab switching — jQuery DOM manipulation ───────────────────────────
  $('.nav-tab-link').on('click', function (e) {
    e.preventDefault();
    const tab = $(this).data('tab');
    $('.nav-tab-link').removeClass('active');
    $(this).addClass('active');
    $('.tab-section').addClass('d-none');
    $('#tab-' + tab).removeClass('d-none');
    if (tab === 'all') loadAllVehicles();
  });

  // ── 5. Clear form with fade animation ────────────────────────────────────
  $('#btnClearForm').on('click', function () {
    $('#registerForm')[0].reset();
    $('#registerForm .is-invalid').removeClass('is-invalid');
    $('#qrResult').fadeOut(300, function () { $(this).addClass('d-none'); });
    showToast('Form cleared', 'info');
  });

  // ── 2. AJAX: Register Vehicle ─────────────────────────────────────────────
  $('#registerForm').on('submit', function (e) {
    e.preventDefault();

    // ── 3. Collect ALL values first, then validate ────────────────────────
    const fields = ['RegNo', 'FirstName', 'LastName', 'Email', 'OwnerNIC', 'FuelType', 'VehicleModel', 'NearestStation'];
    const data = {};
    const emptyFields = [];

    // Collect every field value regardless
    $.each(fields, function (i, field) {
      const $input = $('#reg-' + field);
      const val = $input.val().trim();
      data[field] = val;
      if (!val) {
        emptyFields.push(field);
        $input.addClass('is-invalid');
      } else {
        $input.removeClass('is-invalid');
      }
    });

    if (emptyFields.length > 0) {
      showToast('Please fill all required fields', 'danger');
      return;
    }

    // Normalise RegNo
    data.RegNo = data.RegNo.toUpperCase();

    // ── 3. Disable submit with .prop() ────────────────────────────────────
    $('#registerForm button[type=submit]')
      .prop('disabled', true)
      .html('<span class="spinner-border spinner-border-sm me-2"></span>Registering...');

    // ── 2. AJAX POST ──────────────────────────────────────────────────────
    $.ajax({
      url: API,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: function (res) {
        showToast('Vehicle registered successfully!', 'success');
        renderQRResult(res.data);
        $('#registerForm')[0].reset();
        $('#registerForm .is-invalid').removeClass('is-invalid');
      },
      error: function (xhr) {
        const msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Registration failed';
        showToast(msg, 'danger');
      },
      complete: function () {
        $('#registerForm button[type=submit]')
          .prop('disabled', false)
          .html('<i class="fa-solid fa-plus me-2"></i>Register Vehicle');
      }
    });
  });

  // Remove is-invalid as user types
  $('#registerForm').on('input change', 'input, select', function () {
    if ($(this).val().trim()) $(this).removeClass('is-invalid');
  });

  // ── 2. Refresh all vehicles ───────────────────────────────────────────────
  $('#btnRefresh').on('click', loadAllVehicles);

  // ── 4. Live table filter — jQuery .filter() ──────────────────────────────
  $('#tableFilter').on('keyup', function () {
    const q = $(this).val().toLowerCase();
    $('#vehicleTableBody tr').filter(function () {
      $(this).toggle($(this).text().toLowerCase().indexOf(q) > -1);
    });
  });

  // ── 2. Search ─────────────────────────────────────────────────────────────
  $('#btnSearch').on('click', searchVehicles);
  $('#searchValue').on('keypress', function (e) {
    if (e.key === 'Enter') searchVehicles();
  });

  // ── 2. Update ─────────────────────────────────────────────────────────────
  $('#btnFetchForUpdate').on('click', fetchForUpdate);
  $('#updateIdentifier').on('keypress', function (e) {
    if (e.key === 'Enter') fetchForUpdate();
  });
  $('#btnSaveUpdate').on('click', saveUpdate);

  // ── 2. Delete ─────────────────────────────────────────────────────────────
  $('#btnDelete').on('click', function () {
    const regNo = $('#deleteRegNo').val().trim().toUpperCase();
    if (!regNo) { showToast('Enter a registration number', 'danger'); return; }
    if (!confirm('Delete vehicle ' + regNo + '? This cannot be undone.')) return;

    $.ajax({
      url: API + '/regno/' + encodeURIComponent(regNo),
      type: 'DELETE',
      success: function (res) {
        showToast(res.message, 'success');
        // ── 5. Fade in result ─────────────────────────────────────────────
        $('#deleteResult')
          .html('<div class="alert alert-success"><i class="fa-solid fa-check-circle me-2"></i>' + res.message + '</div>')
          .hide().fadeIn(400);
        $('#deleteRegNo').val('');
      },
      error: function (xhr) {
        const msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Delete failed';
        showToast(msg, 'danger');
        $('#deleteResult')
          .html('<div class="alert alert-danger"><i class="fa-solid fa-circle-xmark me-2"></i>' + msg + '</div>')
          .hide().fadeIn(400);
      }
    });
  });

  // QR Modal download button
  $('#btnModalDownload').on('click', function () {
    const src = $('#modalQrImage').attr('src');
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = 'vehicle-qr-' + ($('#modalQrImage').data('regno') || 'code') + '.png';
    a.click();
  });

  // QR thumbnail click — delegated so it works on dynamically added rows
  $(document).on('click', '.show-qr-btn', function () {
    const $el = $(this);
    const qrSrc = $el.data('qr');
    if (!qrSrc) return;
    $('#modalQrImage').attr('src', qrSrc).data('regno', $el.data('regno'));
    $('#modalVehicleInfo').html(
      '<table class="table table-sm table-borderless mb-0">' +
        '<tr><th>Reg No</th><td>' + escHtml($el.data('regno')) + '</td></tr>' +
        '<tr><th>Model</th><td>' + escHtml($el.data('model')) + '</td></tr>' +
        '<tr><th>Fuel</th><td>' + escHtml($el.data('fuel')) + '</td></tr>' +
        '<tr><th>Station</th><td>' + escHtml($el.data('station')) + '</td></tr>' +
      '</table>'
    );
    new bootstrap.Modal(document.getElementById('qrModal')).show();
  });

}); // end document.ready


// ── LOAD ALL VEHICLES ─────────────────────────────────────────────────────────
function loadAllVehicles() {
  // ── 1. DOM show/hide ──────────────────────────────────────────────────────
  $('#loadingSpinner').removeClass('d-none');
  $('#vehicleTableBody').empty();
  $('#vehicleTable').hide();
  $('#noVehicles').addClass('d-none');
  $('#vehicleCount').text('');

  // ── 2. AJAX GET ───────────────────────────────────────────────────────────
  $.get(API, function (res) {
    $('#loadingSpinner').addClass('d-none');
    const vehicles = res.data;
    $('#vehicleCount').text('Total: ' + vehicles.length + ' vehicle(s)');

    if (vehicles.length === 0) {
      $('#noVehicles').removeClass('d-none');
      return;
    }

    // ── 1. Build table rows with jQuery DOM manipulation ──────────────────
    $.each(vehicles, function (i, v) {
      const fuelClass = v.FuelType === 'Petrol' ? 'fuel-petrol' : v.FuelType === 'Diesel' ? 'fuel-diesel' : 'fuel-electric';
      const $row = $('<tr>').html(
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + escHtml(v.RegNo) + '</strong></td>' +
        '<td>' + escHtml(v.FirstName) + ' ' + escHtml(v.LastName) + '</td>' +
        '<td>' + escHtml(v.Email) + '</td>' +
        '<td>' + escHtml(v.OwnerNIC) + '</td>' +
        '<td><span class="fuel-badge ' + fuelClass + '">' + escHtml(v.FuelType) + '</span></td>' +
        '<td>' + escHtml(v.VehicleModel) + '</td>' +
        '<td>' + escHtml(v.NearestStation) + '</td>' +
        '<td>' + (v.QRCode ? '<img src="' + v.QRCode + '" class="show-qr-btn qr-thumb" alt="QR" style="width:42px;height:42px;cursor:pointer;border-radius:6px;border:2px solid #e2e8f0;"/>' : '<span class="text-muted small">N/A</span>') + '</td>'
      );
      // Store QR data via jQuery .data() — not HTML attributes (avoids base64 attribute bloat)
      if (v.QRCode) {
        $row.find('.show-qr-btn')
          .data('qr', v.QRCode)
          .data('regno', v.RegNo)
          .data('model', v.VehicleModel)
          .data('fuel', v.FuelType)
          .data('station', v.NearestStation);
      }
      $('#vehicleTableBody').append($row);
    });

    // ── 5. Fade in table ──────────────────────────────────────────────────
    $('#vehicleTable').fadeIn(500);

  }).fail(function (xhr) {
    $('#loadingSpinner').addClass('d-none');
    const msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Failed to load vehicles';
    showToast(msg, 'danger');
  });
}


// ── SEARCH VEHICLES ───────────────────────────────────────────────────────────
function searchVehicles() {
  const type  = $('#searchType').val();
  const value = $('#searchValue').val().trim();
  if (!value) { showToast('Enter a search value', 'danger'); return; }

  const urlMap = {
    regno:     API + '/regno/'     + encodeURIComponent(value),
    firstname: API + '/firstname/' + encodeURIComponent(value),
    lastname:  API + '/lastname/'  + encodeURIComponent(value),
    email:     API + '/email/'     + encodeURIComponent(value),
    station:   API + '/station/'   + encodeURIComponent(value),
    fueltype:  API + '/fueltype/'  + encodeURIComponent(value),
    nic:       API + '/nic/'       + encodeURIComponent(value)
  };

  $('#searchResults').html('<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Searching...</div>');

  $.get(urlMap[type], function (res) {
    const vehicles = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
    if (vehicles.length === 0) {
      $('#searchResults').html('<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation me-2"></i>No results found.</div>');
      return;
    }

    let html = '<div class="mb-2 text-muted small">' + vehicles.length + ' result(s) found</div>';
    $.each(vehicles, function (i, v) {
      const fuelClass = v.FuelType === 'Petrol' ? 'fuel-petrol' : v.FuelType === 'Diesel' ? 'fuel-diesel' : 'fuel-electric';
      html +=
        '<div class="result-vehicle-card" id="src-card-' + i + '">' +
          (v.QRCode ? '<img src="' + v.QRCode + '" class="result-qr show-qr-btn qr-thumb" alt="QR"/>' : '') +
          '<div class="flex-grow-1">' +
            '<div class="result-regno">' + escHtml(v.RegNo) + '</div>' +
            '<div class="result-owner">' + escHtml(v.FirstName) + ' ' + escHtml(v.LastName) +
              ' &bull; ' + escHtml(v.Email) + ' &bull; NIC: ' + escHtml(v.OwnerNIC) + '</div>' +
            '<div class="mt-1"><span class="fuel-badge ' + fuelClass + ' me-1">' + escHtml(v.FuelType) + '</span>' +
              '<span class="text-muted small">' + escHtml(v.VehicleModel) + ' &bull; ' + escHtml(v.NearestStation) + '</span></div>' +
          '</div>' +
        '</div>';
    });

    // ── 5. Fade in search results ─────────────────────────────────────────
    $('#searchResults').html(html).hide().fadeIn(400);

    // Attach QR data via .data() after DOM is built
    $.each(vehicles, function (i, v) {
      if (v.QRCode) {
        $('#src-card-' + i + ' .show-qr-btn')
          .data('qr', v.QRCode).data('regno', v.RegNo)
          .data('model', v.VehicleModel).data('fuel', v.FuelType).data('station', v.NearestStation);
      }
    });

  }).fail(function (xhr) {
    const msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Search failed';
    $('#searchResults').html('<div class="alert alert-danger"><i class="fa-solid fa-circle-xmark me-2"></i>' + msg + '</div>');
  });
}


// ── FETCH VEHICLE FOR UPDATE ──────────────────────────────────────────────────
function fetchForUpdate() {
  const type  = $('#updateType').val();
  const value = $('#updateIdentifier').val().trim();
  if (!value) { showToast('Enter an identifier', 'danger'); return; }

  const url = type === 'regno'
    ? API + '/regno/'     + encodeURIComponent(value)
    : API + '/firstname/' + encodeURIComponent(value);

  $('#btnFetchForUpdate').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');

  $.get(url, function (res) {
    const v = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!v) { showToast('Vehicle not found', 'danger'); return; }

    // ── 3. Populate form with .val() ──────────────────────────────────────
    $('#upd-FirstName').val(v.FirstName);
    $('#upd-LastName').val(v.LastName);
    $('#upd-Email').val(v.Email);
    $('#upd-OwnerNIC').val(v.OwnerNIC);
    $('#upd-FuelType').val(v.FuelType);
    $('#upd-VehicleModel').val(v.VehicleModel);
    $('#upd-NearestStation').val(v.NearestStation);

    // ── 5. SlideDown animation ────────────────────────────────────────────
    $('#updateForm').removeClass('d-none').hide().slideDown(400);
    showToast('Vehicle loaded — edit fields and save', 'success');

  }).fail(function (xhr) {
    const msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Vehicle not found';
    showToast(msg, 'danger');
  }).always(function () {
    $('#btnFetchForUpdate').prop('disabled', false).html('<i class="fa-solid fa-arrow-down me-1"></i>Fetch');
  });
}


// ── SAVE UPDATE ───────────────────────────────────────────────────────────────
function saveUpdate() {
  const type  = $('#updateType').val();
  const value = $('#updateIdentifier').val().trim();
  if (!value) { showToast('Please fetch a vehicle first', 'danger'); return; }

  const url = type === 'regno'
    ? API + '/regno/'     + encodeURIComponent(value)
    : API + '/firstname/' + encodeURIComponent(value);

  const data = {
    FirstName:      $('#upd-FirstName').val().trim(),
    LastName:       $('#upd-LastName').val().trim(),
    Email:          $('#upd-Email').val().trim(),
    OwnerNIC:       $('#upd-OwnerNIC').val().trim(),
    FuelType:       $('#upd-FuelType').val(),
    VehicleModel:   $('#upd-VehicleModel').val().trim(),
    NearestStation: $('#upd-NearestStation').val().trim()
  };

  for (const key in data) {
    if (!data[key]) { showToast('All fields are required', 'danger'); return; }
  }

  $('#btnSaveUpdate').prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Saving...');

  $.ajax({
    url: url,
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify(data),
    success: function (res) {
      showToast(res.message || 'Vehicle updated successfully', 'success');
    },
    error: function (xhr) {
      showToast((xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Update failed', 'danger');
    },
    complete: function () {
      $('#btnSaveUpdate').prop('disabled', false).html('<i class="fa-solid fa-floppy-disk me-2"></i>Save Changes');
    }
  });
}


// ── RENDER QR RESULT AFTER REGISTRATION ──────────────────────────────────────
function renderQRResult(vehicle) {
  if (!vehicle || !vehicle.QRCode) return;
  $('#qrImage').attr('src', vehicle.QRCode);
  $('#qrDetails').html(
    '<div><span class="fw-bold">Reg No:</span> '   + escHtml(vehicle.RegNo) + '</div>' +
    '<div><span class="fw-bold">Owner:</span> '    + escHtml(vehicle.FirstName) + ' ' + escHtml(vehicle.LastName) + '</div>' +
    '<div><span class="fw-bold">Model:</span> '    + escHtml(vehicle.VehicleModel) + '</div>' +
    '<div><span class="fw-bold">Fuel:</span> '     + escHtml(vehicle.FuelType) + '</div>' +
    '<div><span class="fw-bold">Station:</span> '  + escHtml(vehicle.NearestStation) + '</div>' +
    '<div><span class="fw-bold">NIC:</span> '      + escHtml(vehicle.OwnerNIC) + '</div>'
  );
  // ── 5. Fade in ────────────────────────────────────────────────────────────
  $('#qrResult').removeClass('d-none').hide().fadeIn(500);

  $('#btnDownloadQR').off('click').on('click', function () {
    const a = document.createElement('a');
    a.href = vehicle.QRCode;
    a.download = 'QR_' + vehicle.RegNo + '.png';
    a.click();
  });
}


// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
function checkHealth() {
  $.get('/api/health', function (res) {
    if (res.database === 'connected') {
      $('#dbStatus').removeClass('d-none text-warning text-danger').addClass('text-success')
        .html('<i class="fa-solid fa-circle me-1"></i>DB Connected');
    } else {
      $('#dbStatus').removeClass('d-none text-success text-danger').addClass('text-warning')
        .html('<i class="fa-solid fa-circle-exclamation me-1"></i>MongoDB Not Running');
      showDbWarning();
    }
  }).fail(function () {
    $('#dbStatus').removeClass('d-none text-success text-warning').addClass('text-danger')
      .html('<i class="fa-solid fa-circle-xmark me-1"></i>Server Offline');
    showDbWarning();
  });
}

function showDbWarning() {
  if ($('#dbWarning').length) return;
  var html =
    '<div id="dbWarning" class="alert alert-warning alert-dismissible d-flex align-items-start gap-3 mb-4" role="alert">' +
    '  <i class="fa-solid fa-triangle-exclamation fs-4 mt-1 flex-shrink-0"></i>' +
    '  <div>' +
    '    <strong>MongoDB is not running.</strong> The app cannot save or load data without it.<br>' +
    '    <span class="small">macOS: <code>brew services start mongodb-community</code><br>' +
    '    Windows: Open <strong>MongoDB Compass</strong> or start the MongoDB service<br>' +
    '    Linux: <code>sudo systemctl start mongod</code></span>' +
    '  </div>' +
    '  <button type="button" class="btn-close" data-bs-dismiss="alert"></button>' +
    '</div>';
  $('.container.py-4').prepend(html);
}


// ── HTML ESCAPE (prevents XSS) ────────────────────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  type = type || 'success';
  const $t = $('#toastMsg');
  $t.removeClass('bg-success bg-danger bg-info bg-warning text-dark');
  if (type === 'success')     $t.addClass('bg-success');
  else if (type === 'danger') $t.addClass('bg-danger');
  else if (type === 'info')   $t.addClass('bg-info text-dark');
  else                        $t.addClass('bg-warning text-dark');
  $('#toastText').text(msg);
  const existing = bootstrap.Toast.getInstance($t[0]);
  if (existing) existing.hide();
  new bootstrap.Toast($t[0], { delay: 3500 }).show();
}
