from playwright.sync_api import sync_playwright, expect
import os

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ['CHROME_PATH'],args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':420,'height':850},permissions=['clipboard-read','clipboard-write'])
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:(errors.append(str(error)),print("Browser error:",error,flush=True)))
    page.on('dialog',lambda d:(errors.append(d.message),d.dismiss()))
    page.route('**/*',lambda route:route.continue_() if route.request.url.startswith('http://localhost:8765') else route.abort())
    page.add_init_script('''if(location.pathname==="/"){
      localStorage.setItem("taxi-private-session",'{"access_token":"test","expires_at":9999999999}');
      if(!localStorage.getItem("taxi-pickup-prototype-v1")){
        localStorage.setItem("taxi-pickup-prototype-v1",'[{"client":"FICHE DE TEST"}]');
        localStorage.setItem("montaxi:hotel-commissions:courses-v1",'[{"id":"existing","hotel":"Moxy","contact":"Alexis","destination":"Zaventem","date":"2026-11-01","recordedTime":"12:00","bookingMode":"Direct","reservationStatus":"validated","validatedAt":"2026-11-01T12:00","amount":10}]');
      }
    }''')
    page.goto('http://localhost:8765/')
    intro=page.get_by_role("button",name="Appuie pour ouvrir")
    try:
        intro.click(timeout=5000)
    except Exception:
        pass
    page.locator('#openHotelCommissions').click()
    hotel=page.frame_locator('#hotelCommissionsFrame')
    hotel.locator('#startReservation').click()
    expect(hotel.locator('#rideDirection')).to_be_visible()
    hotel.locator('#rideDropoff').click()
    expect(hotel.locator('#reservationForm')).to_be_visible()
    expect(hotel.locator('#reservationHotelOptions')).to_be_visible()
    expect(hotel.locator('#rideDirection')).not_to_be_visible()
    hotel.locator('#closeReservations').click()
    hotel.locator('#startReservation').click()
    hotel.locator('#ridePickup').click()
    pickup=page.frame_locator('#hotelPickupFrame')
    expect(pickup.locator('#save')).to_have_text('Enregistrer la course')
    expect(pickup.locator('h1')).to_contain_text('Pick-up')
    assert pickup.locator('#planning').count()==0
    pickup.locator('#dateChoose').click()
    expect(pickup.locator('#calendar')).to_be_visible()
    pickup.locator('#calendar [data-cal=next]').click()
    pickup.locator('#calendar [data-day="15"]').click()
    pickup.locator('#timeMode').select_option('arrival')
    pickup.locator('#arrivalHour').fill('15')
    pickup.locator('#arrivalMinute').fill('30')
    pickup.locator('#hotelSearch').fill('The Standard')
    pickup.locator('#contactSearch').fill('Fal')
    pickup.locator('#contactSearch').press('Tab')
    pickup.locator('#client').fill('client exemple')
    pickup.locator('#phone').fill('+32470123456')
    pickup.locator('#flight').fill('sn1234')
    pickup.locator('#price').fill('0')
    pickup.locator('#vehicle').select_option('Van')
    pickup.locator('#vans').fill('2')
    pickup.locator('#passengers').fill('5')
    pickup.locator('#reminder60').uncheck()
    pickup.locator('#save').click()
    assert not errors,errors
    expect(page.locator('#hotelPickup')).not_to_be_visible()
    expect(hotel.locator('#reservationList')).to_contain_text('Client Exemple')
    expect(hotel.locator('#reservationList')).to_contain_text('SN1234')
    expect(hotel.locator('#reservationList')).to_contain_text('2 × Van')
    expect(hotel.locator('#reservationList')).to_contain_text('Prix annoncé')
    expect(hotel.locator('#reservationList')).not_to_contain_text('FICHE DE TEST')
    hotel.get_by_role('button',name='Copier la course').click()
    expect(hotel.locator('#reservationBoardMessage')).to_have_text('Course copiée.')
    assert 'SN1234' in page.evaluate('navigator.clipboard.readText()')
    hotel.get_by_role('button',name='Modifier le pick-up').click()
    expect(pickup.locator('#flight')).to_have_value('SN1234')
    expect(pickup.locator('#arrivalHour')).to_have_value('15')
    expect(pickup.locator('#contactSearch')).to_have_value('Fal')
    pickup.locator('#company').fill('Brussels Airlines')
    pickup.locator('#save').click()
    assert not errors,errors
    expect(hotel.locator('#reservationList')).to_contain_text('Brussels Airlines')
    page.locator('#closeHotelCommissions').click()
    page.reload()
    try:
        intro.click(timeout=5000)
    except Exception:
        pass
    page.locator('#openHotelPlanning').click()
    expect(hotel.locator('#reservationList')).to_contain_text('Brussels Airlines')
    page.locator('#hotelQuickMenuBtn').click()
    page.locator('#hotelQuickMenu [data-quick=hotelAll]').click()
    expect(hotel.locator('#reservationList')).to_contain_text('Moxy')
    expect(hotel.locator('#reservationList')).to_contain_text('Brussels Airlines')
    page.locator('#hotelQuickMenuBtn').click()
    page.locator('#hotelQuickMenu [data-quick=direct]').click()
    hotel.locator('#ridePickup').click()
    expect(pickup.locator('h1')).to_contain_text('Pick-up')
    pickup.locator('#hotelSearch').fill('The Standard')
    pickup.locator('#contactSearch').fill('Fal')
    pickup.locator('#contactSearch').press('Tab')
    pickup.locator('#client').fill('client direct')
    pickup.locator('#phone').fill('+32470987654')
    pickup.locator('#flight').fill('sn9876')
    pickup.locator('#save').click()
    assert not errors,errors
    expect(hotel.locator('#reservationList')).to_contain_text('Client Direct')
    expect(hotel.locator('#reservationList')).to_contain_text('Course directe · Effectuée')
    courses=page.evaluate('JSON.parse(localStorage.getItem("montaxi:hotel-commissions:courses-v1"))')
    assert len(courses)==3,courses
    future=next(c for c in courses if c.get('scheduledDate'))
    assert future['contact']=='Fal' and future['announcedPrice']==0 and future['pickup']['reminder60'] is False,future
    assert page.evaluate('(c)=>TaxiHotels.reminders([c]).map(r=>r.minutes)',future)==[30]
    assert not errors,errors
    print('Chromium mobile · Dépose / Pick-up, réservation, copie, modification, rechargement, archives, direct, rappels et exclusion des données prototype OK')
